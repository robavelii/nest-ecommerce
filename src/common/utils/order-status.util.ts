import { OrderStatus } from "../../database/entities/order.entity";

export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
  [OrderStatus.PROCESSING]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED],
  [OrderStatus.DELIVERED]: [OrderStatus.RETURNED],
  [OrderStatus.CANCELLED]: [],
  [OrderStatus.REFUNDED]: [],
  [OrderStatus.RETURNED]: [],
};

export function canTransition(
  currentStatus: OrderStatus,
  newStatus: OrderStatus,
): boolean {
  const allowedTransitions = ORDER_STATUS_TRANSITIONS[currentStatus] || [];
  return allowedTransitions.includes(newStatus) || currentStatus === newStatus;
}

export function getValidTransitions(currentStatus: OrderStatus): OrderStatus[] {
  return ORDER_STATUS_TRANSITIONS[currentStatus] || [];
}

export function isFinalStatus(status: OrderStatus): boolean {
  return ORDER_STATUS_TRANSITIONS[status]?.length === 0;
}
