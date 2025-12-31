import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
// import { GqlExecutionContext } from '@nestjs/graphql';

/* -----------------------------------------------------------------
 * 1️⃣  Helper – get the underlying request (HTTP or GraphQL)
 * ----------------------------------------------------------------- */
function getRequest(context: ExecutionContext): Request {
  // GraphQL → request lives inside the GQL context
//   if (context.getType<'graphql'>() === 'graphql') {
//     const gqlCtx = GqlExecutionContext.create(context);
//     return gqlCtx.getContext().req;
//   }

  // HTTP (Express / Fastify)
  return context.switchToHttp().getRequest<Request>();
}

/* -----------------------------------------------------------------
 * 2️⃣  Shape of the user object that your Auth guard attaches.
 * -----------------------------------------------------------------
 * Adjust this interface to match the payload you actually store in
 * `request.user`. In the code you posted you refer to a `userId`
 * field, so we include it here. Feel free to add any extra fields
 * (email, roles, etc.) – the rest of the app will automatically get
 * proper type‑checking.
 * ----------------------------------------------------------------- */
export interface AuthUser {
  userId: string;                // <-- used in logout, change‑password, etc.
  email?: string;
  // any other fields you put on the user (e.g. roles, name, …)
  // The decorator returns whatever you put here, so keep it in sync
  // with the object created by your JwtAuthGuard / Passport strategy.
}

/* -----------------------------------------------------------------
 * 3️⃣  The actual decorator
 * ----------------------------------------------------------------- */
export const CurrentUser = createParamDecorator(
  /**
   * @param data  Optional key of the user object you want.
   *              If omitted the whole `AuthUser` object is returned.
   * @param ctx   Nest execution context.
   *
   * @returns  Either the full user or a single property (typed).
   */
  <K extends keyof AuthUser = keyof AuthUser>(
    data: K | undefined,
    ctx: ExecutionContext,
  ): AuthUser | AuthUser[K] => {
    const request = getRequest(ctx);
    const user = request.user as AuthUser | undefined;

    // -------------------------------------------------------------
    // 4️⃣ Defensive – make sure a guard actually attached a user.
    // -------------------------------------------------------------
    if (!user) {
      // This protects you from accidentally using @CurrentUser on a
      // @Public route or on a route guarded by a different strategy.
      throw new UnauthorizedException('User not found on request');
    }

    // -------------------------------------------------------------
    // 5️⃣ Return the whole object or the requested property.
    // -------------------------------------------------------------
    return data ? (user[data] as AuthUser[K]) : user;
  },
);