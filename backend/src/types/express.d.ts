import type { HydratedDocument } from "mongoose";
import type { UserDocument } from "../models/user.model";

declare global {
  namespace Express {
    interface Request {
      user?: HydratedDocument<UserDocument>;
    }
  }
}

export {};
