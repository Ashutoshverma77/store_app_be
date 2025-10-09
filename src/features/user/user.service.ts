import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../auth/schema/auth.schema.js';
import { RegisterDto } from '../auth/dto/register.dto.js';
import { CreateAuthDto } from '../auth/dto/create-auth.dto.js';
import { UpdateAuthDto } from '../auth/dto/update-auth.dto.js';
import { UpdateRegistorDto } from '../auth/dto/update-register.dto.js';
import { ResetPasswordDto } from '../auth/dto/reset-password.dto.js';
import bcrypt from 'bcryptjs';

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name, 'auth')
    private userSchema: Model<User>,
  ) {}

  async findByPhoneNo(phoneNumber: string) {
    return this.userSchema.findOne({ phoneNumber }).exec();
  }

  async findAll() {
    return this.userSchema.find().exec();
  }

  async findById(id: string) {
    return this.userSchema.findById(id).exec();
  }

  async findOne(id: string) {
    return this.userSchema.findOne({ _id: id }).exec();
  }

  async findByEmail(email: string) {
    return this.userSchema.findOne({ email }).exec();
  }

  async createAuth(data: RegisterDto) {
    const doc: User = new this.userSchema(data);
    await doc.save();
    return doc;
  }

  async updateAuth(data: UpdateRegistorDto) {
    const doc: User | null = await this.userSchema.findByIdAndUpdate(
      data.id,
      data,
    );
    return doc;
  }

  async findUserPaged(body: any) {
    const page = Math.max(1, Number(body?.page ?? 1));
    const limit = Math.min(200, Math.max(1, Number(body?.limit ?? 12)));
    const skip = (page - 1) * limit;

    const qText = String(body?.q ?? '').trim();
    const field = String(body?.field ?? 'all'); // all | name | email | phone

    // sort
    const sortStr = String(body?.sort ?? '-createdAt');
    const dir = sortStr.startsWith('-') ? -1 : 1;
    const fieldName = sortStr.replace(/^-/, '') || 'createdAt';
    const sort: Record<string, 1 | -1> = { [fieldName]: dir };

    // filter
    const filter: any = {};
    if (qText) {
      const rx = { $regex: qText, $options: 'i' };
      if (field === 'name') filter.name = rx;
      else if (field === 'email') filter.email = rx;
      else if (field === 'phone') filter.phoneNumber = rx;
      else {
        filter.$or = [{ name: rx }, { email: rx }, { phoneNumber: rx }];
      }
    }

    const project = {
      name: 1,
      email: 1,
      phoneNumber: 1,
      isActive: 1,
      isSuperAdmin: 1,
      createdAt: 1,
      updatedAt: 1,
    };

    const [rows, total] = await Promise.all([
      this.userSchema
        .find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        // .select(project)
        .lean(),
      this.userSchema.countDocuments(filter),
    ]);

    return {
      rows: rows.map((u: any) => ({
        ...u,
        _id: String(u._id ?? ''), // normalize id to FE shape if needed
      })),
      total,
      page,
      limit,
    };
  }

  async updaterResetPwd(data: ResetPasswordDto) {
    const hash = await bcrypt.hash(data.newPassword, 10);
    const doc: User | null = await this.userSchema.findByIdAndUpdate(
      data.userId,
      {
        $set: {
          password: hash,
        },
      },
    );
    return doc;
  }

  async deleteAuth(id: string) {
    const doc: User | null = await this.userSchema.findByIdAndDelete(id);
    return doc;
  }

  // async createAdmin(data: CreateAuthDto) {
  //   const doc: User = new this.userSchema(data);
  //   await doc.save();
  //   return doc;
  // }

  // async update(data: UpdateAuthDto) {
  //   const doc: User = new this.userSchema(data);
  //   return doc;
  // }
}
