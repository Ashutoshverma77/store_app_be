import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { JwtAuthGuard } from '../guards/jwt-auth.guard.js';
import { CurrentUser } from '../decorators/user.decorator.js';
import { CreateAuthDto } from './dto/create-auth.dto.js';
import { UpdateAuthDto } from './dto/update-auth.dto.js';
import { UpdateRegistorDto } from './dto/update-register.dto.js';
import { AuthGateway } from './auth.gateway.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';

@Controller('/api/auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly gateway: AuthGateway,
  ) {}

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    var res = await this.auth.register(dto);

    this.gateway.broadcastAuthList().catch(() => {});

    return res;
  }

  @Post('createuser')
  async createRegister(@Body() dto: RegisterDto) {
    const res = await this.auth.createRegister(dto);
    // Fire-and-forget; don’t block the HTTP response on this
    this.gateway.broadcastAuthList().catch(() => {});
    return res;
  }

  @Put('createuser/:id')
  async updateregister(@Body() dto: UpdateRegistorDto) {
    const res = await this.auth.updateregister(dto);
    this.gateway.broadcastAuthList().catch(() => {});
    return res;
  }

  @Put('reset/:id')
  async updatereset(@Body() dto: ResetPasswordDto) {
    const res = await this.auth.updatereset(dto);
    this.gateway.broadcastAuthList().catch(() => {});
    return res;
  }

  @Put('delete/:id')
  async deleteregister(@Body() dto: any) {
    const res = await this.auth.deleteregister(dto.userId);
    this.gateway.broadcastAuthList().catch(() => {});
    return res;
  }

  @Post('google')
  async google(@Body('idToken') idToken: string) {
    const res = this.auth.loginWithGoogle(idToken);
    this.gateway.broadcastAuthList().catch(() => {});
    return res;
  }

  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  // @UseGuards(JwtAuthGuard)
  @Get('users/:id')
  async Get(@Param('id') id: string) {
    return this.auth.findByIdUsers(id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@CurrentUser() user?: { userId: string }) {
    return { ok: true, userId: user?.userId };
  }

  // @UseGuards(JwtAuthGuard)
  // @Put('users')
  // async create(@Body() dto: CreateAuthDto) {
  //   return this.auth.create(dto);
  // }

  // @UseGuards(JwtAuthGuard)
  // @Put('users/:id')
  // async update(@Body() dto: UpdateAuthDto) {
  //   return this.auth.update(dto);
  // }
}
