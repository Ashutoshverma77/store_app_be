import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { Division } from './division.schema';

@Schema({ timestamps: true })
export class User extends Document {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ unique: true, required: true })
  phoneNumber: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  password: string;

  @Prop({ default: '' })
  fcmToken: string;

  @Prop({ default: false })
  isActive: boolean;

  @Prop({ required: true, default: false })
  isSuperAdmin: boolean;

  @Prop({ default: [] })
  devices: string[];

  @Prop({ default: [] })
  deviceHistory: string[];

  @Prop({ default: [] }) // <— subdocs
  apps: string[];

  @Prop({ default: [] }) // <— subdocs
  appWorks: string[];

  @Prop({ default: '' }) imageUrl: string;

  @Prop() signatureUrl: string;

  @Prop({
    type: [{ type: mongoose.Schema.Types.ObjectId, ref: Division.name }],
    default: [],
  })
  divisionIds: mongoose.Types.ObjectId[];
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.pre('save', function (next) {
  var user = this;
  if (this.isModified('password') || this.isNew) {
    bcrypt.genSalt(10, function (err, salt) {
      if (err) {
        return next(err);
      }
      bcrypt.hash(user.password, salt, function (err, hash) {
        if (err) {
          return next(err);
        }
        user.password = hash;
        next();
      });
    });
  } else {
    return next();
  }
});
