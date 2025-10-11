import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';
import { UserService } from '../user/user.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { User } from './schema/auth.schema.js';
import { CreateAuthDto } from './dto/create-auth.dto.js';
import { UpdateAuthDto } from './dto/update-auth.dto.js';
import { UpdateRegistorDto } from './dto/update-register.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { AnyCaaRecord } from 'dns';
import { v4 as uuid } from 'uuid';
import { minioClient } from 'src/config/minio.config.js';

@Injectable()
export class AuthService {
  private google: OAuth2Client;
  private readonly bucketName = process.env.MINIO_BUCKET || 'auth';
  constructor(
    private readonly users: UserService,
    private jwt: JwtService,
  ) {
    this.google = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
  }

  async register(registerDto: RegisterDto) {
    // const exists = await this.users.findByPhoneNo(registerDto.phoneNumber);
    // if (exists) throw new BadRequestException('Email already used');

    // --- FIX 1: Check if EITHER email or phone number already exist ---
    const userByEmail = await this.users.findByEmail(registerDto.email);
    if (userByEmail) {
      // --- FIX 2: Use a more specific exception and message ---
      return {
        token: '',
        // user: {
        //   // id: userByEmail.id,
        //   email: userByEmail.email,
        //   // phoneNumber: userByEmail.phoneNumber,
        //   // name: userByEmail.name,
        // },
        msg: 'An account with this email already exists.',
        status: false,
      };
    }

    const userByPhone = await this.users.findByPhoneNo(registerDto.phoneNumber);
    if (userByPhone) {
      return {
        token: '',
        // user: {
        //   // id: userByPhone.id,
        //   // email: userByPhone.email,
        //   phoneNumber: userByPhone.phoneNumber,
        //   // name: userByPhone.name,
        // },
        msg: 'An account with this phone number already exists.',
        status: false,
      };
    }

    const hash = await bcrypt.hash(registerDto.password, 10);
    const user = await this.users.createAuth(registerDto);
    user.save();
    const token = await this.sign(user.id);
    return {
      token,
      id: user._id,
      msg: 'User Created Successfully.....',
      status: true,
    };
  }

  async createRegister(registerDto: RegisterDto) {
    // const exists = await this.users.findByPhoneNo(registerDto.phoneNumber);
    // if (exists) throw new BadRequestException('Email already used');

    // --- FIX 1: Check if EITHER email or phone number already exist ---
    const userByEmail = await this.users.findByEmail(registerDto.email);
    if (userByEmail) {
      // --- FIX 2: Use a more specific exception and message ---
      return {
        // user: {
        //   // id: userByEmail.id,
        //   email: userByEmail.email,
        //   // phoneNumber: userByEmail.phoneNumber,
        //   // name: userByEmail.name,
        // },
        msg: 'An account with this email already exists.',
        status: false,
      };
    }

    const userByPhone = await this.users.findByPhoneNo(registerDto.phoneNumber);
    if (userByPhone) {
      return {
        // user: {
        //   // id: userByPhone.id,
        //   // email: userByPhone.email,
        //   phoneNumber: userByPhone.phoneNumber,
        //   // name: userByPhone.name,
        // },
        msg: 'An account with this phone number already exists.',
        status: false,
      };
    }

    const hash = await bcrypt.hash(registerDto.password, 10);
    const user = await this.users.createAuth(registerDto);
    user.save();
    return {
      id: user._id,
      msg: 'User Created Successfully.....',
      status: true,
    };
  }

  async updateregister(updateRegistorDto: UpdateRegistorDto) {
    // const exists = await this.users.findByPhoneNo(registerDto.phoneNumber);
    // if (exists) throw new BadRequestException('Email already used');

    // --- FIX 1: Check if EITHER email or phone number already exist ---
    const userByid = await this.users.findById(updateRegistorDto.id);
    if (!userByid) {
      // --- FIX 2: Use a more specific exception and message ---
      return {
        // user: {
        //   // id: userByEmail.id,
        //   email: userByEmail.email,
        //   // phoneNumber: userByEmail.phoneNumber,
        //   // name: userByEmail.name,
        // },
        msg: 'An account with this doesn`t exists.',
        status: false,
      };
    }

    // const hash = await bcrypt.hash(registerDto.password, 10);
    const user = await this.users.updateAuth(updateRegistorDto);

    // const token = await this.sign(user!.id);
    return {
      // token,
      id: user!._id,
      msg: 'User Updated Successfully.....',
      status: true,
    };
  }

  async updatereset(resetPasswordDto: ResetPasswordDto) {
    // const exists = await this.users.findByPhoneNo(registerDto.phoneNumber);
    // if (exists) throw new BadRequestException('Email already used');

    // --- FIX 1: Check if EITHER email or phone number already exist ---
    const userByid = await this.users.findById(resetPasswordDto.userId);
    if (!userByid) {
      // --- FIX 2: Use a more specific exception and message ---
      return {
        // user: {
        //   // id: userByEmail.id,
        //   email: userByEmail.email,
        //   // phoneNumber: userByEmail.phoneNumber,
        //   // name: userByEmail.name,
        // },
        msg: 'An account with this doesn`t exists.',
        status: false,
      };
    }

    const newhash = await bcrypt.hash(resetPasswordDto.newPassword, 10);
    if (newhash == userByid.password) {
      // --- FIX 2: Use a more specific exception and message ---
      return {
        // user: {
        //   // id: userByEmail.id,
        //   email: userByEmail.email,
        //   // phoneNumber: userByEmail.phoneNumber,
        //   // name: userByEmail.name,
        // },
        msg: 'An account with this password is same',
        status: false,
      };
    }

    // const hash = await bcrypt.hash(registerDto.password, 10);
    const user = await this.users.updaterResetPwd(resetPasswordDto);

    // const token = await this.sign(user!.id);
    return {
      // token,
      id: user!._id,
      msg: 'User Updated Successfully.....',
      status: true,
    };
  }

  async deleteregister(id: string) {
    // const exists = await this.users.findByPhoneNo(registerDto.phoneNumber);
    // if (exists) throw new BadRequestException('Email already used');

    // --- FIX 1: Check if EITHER email or phone number already exist ---
    const userByid = await this.users.findById(id);
    if (!userByid) {
      // --- FIX 2: Use a more specific exception and message ---
      return {
        // user: {
        //   // id: userByEmail.id,
        //   email: userByEmail.email,
        //   // phoneNumber: userByEmail.phoneNumber,
        //   // name: userByEmail.name,
        // },
        msg: 'An account with this doesn`t exists.',
        status: false,
      };
    }
    // const hash = await bcrypt.hash(registerDto.password, 10);
    await this.users.deleteAuth(id);

    // const token = await this.sign(user!.id);
    return {
      msg: 'User Deleted Successfully.....',
      status: true,
    };
  }

  async login(loginDto: LoginDto) {
    // const user = await this.users.findByPhoneNo(loginDto.phoneNumber);
    // if (!user) throw new UnauthorizedException('Invalid credentials');
    let user;

    // Check if the identifier is an email by looking for the '@' symbol
    const isEmail = loginDto.identifier.includes('@');

    if (isEmail) {
      // If it's an email, find the user by their email address
      user = await this.users.findByEmail(loginDto.identifier);
    } else {
      // Otherwise, assume it's a phone number
      // ✨ It's a good practice to normalize the phone number first
      const normalizedPhone = loginDto.identifier.replace(/[\s-()]/g, '');
      user = await this.users.findByPhoneNo(normalizedPhone);
    }

    // The rest of your logic remains exactly the same
    if (!user) {
      return {
        token: '',
        msg: 'Invalid credentials',
        status: false,
      };
    }

    if (user.isActive == false) {
      return {
        token: '',
        msg: 'You Are Currently Not Active....',
        status: false,
      };
    }

    const ok = await bcrypt.compare(loginDto.password, user.password);
    if (!ok) {
      return {
        token: '',
        msg: 'Invalid credentials',
        status: false,
      };
    }
    const token = await this.sign(user.id);
    return {
      token,
      id: user._id,
      msg: 'User Login Successfully.....',
      status: true,
    };
  }

  private async sign(userId: string) {
    return this.jwt.signAsync(
      {},
      { subject: userId, expiresIn: process.env.JWT_EXPIRES },
    );
  }

  async loginWithGoogle(idToken: string) {
    if (!idToken) throw new BadRequestException('Missing idToken');

    const ticket = await this.google.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload) throw new BadRequestException('Invalid Google token');

    const { sub, email, name, picture, email_verified } = payload;
    if (!email || !email_verified) {
      throw new BadRequestException('Email not verified by Google');
    }

    // Upsert user by email
    var user: User | any = await this.users.findByEmail(email);
    if (!user) {
      user = await this.users.createAuth({
        email,
        name: name || email.split('@')[0],
        phoneNumber: '',
        password: '250925', // placeholder, not used
        isActive: false,
        isSuperAdmin: false,
        apps: [],
        appWorks: [],
      });
    }

    const token = await this.sign(user.id);
    return {
      token,
      user: { id: user.id, email: user.email, name: user.name, picture },
      provider: 'google',
    };
  }

  async findAllUsers() {
    return await this.users.findAll();
  }

  async findOneUsers(id: string) {
    return await this.users.findOne(id);
  }

  async findByIdUsers(id: string) {
    return await this.users.findById(id);
  }

  async findUserPaged(body: any) {
    var users = await this.users.findUserPaged(body);
    return users;
  }

  // async create(user: CreateAuthDto) {
  //   return await this.users.createAdmin(user);
  // }

  // async update(user: UpdateAuthDto) {
  //   return await this.users.update(user);
  // }
}
