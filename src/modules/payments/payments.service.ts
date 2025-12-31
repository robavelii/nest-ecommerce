import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { Payment, PaymentStatus, PaymentMethod } from '../../database/entities/payment.entity';
import { Order, OrderStatus } from '../../database/entities/order.entity';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';
import { LoggerServiceImpl as CustomLogger } from '../../common/logger/logger.service';

@Injectable()
export class PaymentsService {
  private stripe: Stripe;

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
    private readonly logger: CustomLogger,
  ) {
    const stripeKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (stripeKey) {
      this.stripe = new Stripe(stripeKey, {
        apiVersion: '2023-10-16',
      });
    }
  }

  async createPaymentIntent(createPaymentIntentDto: CreatePaymentIntentDto) {
    if (!this.stripe) {
      throw new BadRequestException('Stripe is not configured');
    }

    const order = await this.orderRepository.findOne({
      where: { id: createPaymentIntentDto.orderId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException('Order is not pending payment');
    }

    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: Math.round(order.total * 100), // Convert to cents
      currency: 'usd',
      metadata: {
        orderId: order.id,
        orderNumber: order.orderNumber,
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    // Create or update payment record
    let payment = await this.paymentRepository.findOne({
      where: { stripePaymentIntentId: paymentIntent.id },
    });

    if (!payment) {
      payment = this.paymentRepository.create({
        orderId: order.id,
        amount: order.total,
        currency: 'USD',
        paymentMethod: PaymentMethod.STRIPE,
        paymentStatus: PaymentStatus.PENDING,
        stripePaymentIntentId: paymentIntent.id,
        description: `Payment for order ${order.orderNumber}`,
      });
    } else {
      payment.paymentStatus = PaymentStatus.PENDING;
    }

    await this.paymentRepository.save(payment);

    return {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    };
  }

  async confirmPayment(paymentIntentId: string): Promise<Payment> {
    const payment = await this.paymentRepository.findOne({
      where: { stripePaymentIntentId: paymentIntentId },
      relations: ['order'],
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (!this.stripe) {
      throw new BadRequestException('Stripe is not configured');
    }

    const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status === 'succeeded') {
      payment.paymentStatus = PaymentStatus.COMPLETED;
      payment.transactionId = paymentIntent.id;
      const latestCharge = await this.stripe.charges.retrieve(
        paymentIntent.latest_charge as string
      );
      payment.receiptUrl = latestCharge?.receipt_url || null;
      await this.paymentRepository.save(payment);

      // Update order status
      await this.orderRepository.update(payment.orderId, {
        status: OrderStatus.CONFIRMED,
      });

      this.logger.log(`Payment confirmed for order ${payment.orderId}`, 'PaymentsService');
    }

    return payment;
  }

  async handleWebhook(signature: string, payload: Buffer) {
    if (!this.stripe) {
      throw new BadRequestException('Stripe is not configured');
    }

    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');
    
    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (err) {
      throw new BadRequestException(`Webhook signature verification failed`);
    }

    switch (event.type) {
      case 'payment_intent.succeeded':
        await this.handlePaymentSuccess(event.data.object as Stripe.PaymentIntent);
        break;
      case 'payment_intent.payment_failed':
        await this.handlePaymentFailure(event.data.object as Stripe.PaymentIntent);
        break;
      case 'charge.refunded':
        await this.handleRefund(event.data.object as Stripe.Charge);
        break;
    }

    return { received: true };
  }

  private async handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent) {
    const payment = await this.paymentRepository.findOne({
      where: { stripePaymentIntentId: paymentIntent.id },
    });

    if (payment) {
      payment.paymentStatus = PaymentStatus.COMPLETED;
      payment.transactionId = paymentIntent.id;
      await this.paymentRepository.save(payment);

      await this.orderRepository.update(payment.orderId, {
        status: OrderStatus.CONFIRMED,
      });

      this.logger.log(`Payment succeeded for order ${payment.orderId}`, 'PaymentsService');
    }
  }

  private async handlePaymentFailure(paymentIntent: Stripe.PaymentIntent) {
    const payment = await this.paymentRepository.findOne({
      where: { stripePaymentIntentId: paymentIntent.id },
    });

    if (payment) {
      payment.paymentStatus = PaymentStatus.FAILED;
      await this.paymentRepository.save(payment);

      this.logger.warn(`Payment failed for order ${payment.orderId}`, 'PaymentsService');
    }
  }

  private async handleRefund(charge: Stripe.Charge) {
    const paymentIntentId = charge.payment_intent as string;
    const payment = await this.paymentRepository.findOne({
      where: { stripePaymentIntentId: paymentIntentId },
    });

    if (payment) {
      payment.paymentStatus = PaymentStatus.REFUNDED;
      payment.refundedAt = new Date();
      payment.refundAmount = (charge.amount_refunded || 0) / 100;
      await this.paymentRepository.save(payment);

      await this.orderRepository.update(payment.orderId, {
        status: OrderStatus.REFUNDED,
      });

      this.logger.log(`Payment refunded for order ${payment.orderId}`, 'PaymentsService');
    }
  }

  async getPaymentMethods(userId: string) {
    // TODO: Implement saved payment methods
    // This would integrate with Stripe Customer objects
    return [];
  }

  async createRefund(orderId: string, amount?: number, reason?: string): Promise<Payment> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['payments'],
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const payment = order.payments?.find(p => p.paymentStatus === PaymentStatus.COMPLETED);
    if (!payment) {
      throw new NotFoundException('Completed payment not found');
    }

    if (!this.stripe) {
      throw new BadRequestException('Stripe is not configured');
    }

    const refundAmount = amount || payment.amount;
    
    try {
      await this.stripe.refunds.create({
        payment_intent: payment.stripePaymentIntentId,
        amount: Math.round(refundAmount * 100),
        reason: 'requested_by_customer',
      });

      payment.paymentStatus = PaymentStatus.REFUNDED;
      payment.refundedAt = new Date();
      payment.refundAmount = refundAmount;
      payment.refundReason = reason;
      await this.paymentRepository.save(payment);

      await this.orderRepository.update(orderId, {
        status: OrderStatus.REFUNDED,
      });

      this.logger.log(`Refund processed for order ${order.orderNumber}`, 'PaymentsService');
      return payment;
    } catch (error) {
      this.logger.error(`Refund failed for order ${order.orderNumber}`, error.stack, 'PaymentsService');
      throw new BadRequestException('Refund failed');
    }
  }

  async getOrderPayments(orderId: string): Promise<Payment[]> {
    return this.paymentRepository.find({
      where: { orderId },
      order: { createdAt: 'DESC' },
    });
  }
}
