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
