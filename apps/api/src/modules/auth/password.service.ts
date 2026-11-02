import { Injectable } from '@nestjs/common';
import bcrypt from 'bcryptjs';

// RN-AUTH-02: bcrypt with cost >= 12.
export const BCRYPT_COST = 12;

@Injectable()
export class PasswordService {
  hash(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_COST);
  }

  verify(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
}
