import { Request } from 'express';
import { Role, Garage } from '@prisma/client';

export interface TokenPayload {
  userId: string;
  role: Role;
  email: string;
}

export interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
  garage?: Garage;
}
