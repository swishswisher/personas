import { AsyncLocalStorage } from "node:async_hooks";
import { db, type Tx } from "./db";
// Better Auth wraps its operations in Prisma transactions. Carry that exact
// transaction into the email outbox callback, so identity and delivery intent
// commit together and do not require a second database connection.
export const authTransaction = new AsyncLocalStorage<Tx>();
export const authDatabase = new Proxy(db, {
  get(target, property, receiver) {
    if (property === "$transaction")
      return (callback: (tx: Tx) => Promise<unknown>) =>
        target.$transaction(
          (tx) => authTransaction.run(tx, () => callback(tx)),
          { timeout: 15000 },
        );
    return Reflect.get(target, property, receiver);
  },
});
