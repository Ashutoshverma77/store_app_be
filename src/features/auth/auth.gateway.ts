import {
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { AuthService } from './auth.service.js';
import { JwtService } from '@nestjs/jwt';
import { CurrentUser } from '../decorators/user.decorator.js';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard.js';

// @UseGuards(JwtAuthGuard)
@WebSocketGateway()
export class AuthGateway {
  @WebSocketServer() server: any;
  constructor(
    private readonly auth: AuthService,
    private readonly jwt: JwtService,
  ) {}

  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user?: { userId: string }) {
    return { ok: true, userId: user?.userId };
  }

  async broadcastAuthList() {
    const list = await this.auth.findAllUsers();
    this.server.emit('auth:findAll', list); // broadcast to all clients
  }

  @SubscribeMessage('auth:connection')
  async handleConnect(client: any, payload: any): Promise<string> {
    var id: string = payload.id;
    if (id.length > 0) {
      var user = await this.auth.findByIdUsers(id);

      console.log(`User connected ${user!.name} ${client.id}`);

      // try {
      //   // Send the notification
      //   const fcmResponse = await this.mobileNotificationService.sendNotificationToSingleDevice(
      //     user.fcmToken,
      //     {
      //       title: 'demo title',
      //       body: 'this is the body of the notification',
      //     },
      //   );

      //   console.log('FCM Response:', fcmResponse);
      //   // Handle response or return it if needed
      //   return fcmResponse;
      // } catch (error) {
      //   console.error('Error sending notification:', error);
      //   // Handle error appropriately
      //   throw error;
      // }

      // var fcmresponse =
      //   await this.mobileNotificationService.sendNotificationToSingleDevice(
      //     user.fcmToken,
      //     {
      //       title: 'demo title',
      //       body: 'this is the body of the notification',
      //     },
      //   );

      // console.log('FCM : ' + fcmresponse);

      client.emit('auth:connection', user);
    }
    console.log(this.server.engine.clientsCount);

    return 'Hello world!';
  }

  @SubscribeMessage('auth:disconnect')
  async disconnectMessage(client: any, payload: any): Promise<string> {
    console.log('Logged disconnect');

    var id: string = payload.id;
    var user = await this.auth.findByIdUsers(id);
    console.log(`User disconnected ${user!.name}`);
    return 'Hello world!';
  }

  @SubscribeMessage('auth:findAll')
  async findAll(client: any, payload: any) {
    var authUserList = await this.auth.findAllUsers();

    client.emit('auth:findAll', authUserList);
    return;
  }

  @SubscribeMessage('auth:findOne')
  async findOne(client: any, payload: any) {
    var authUserList = await this.auth.findOneUsers(payload.id);
    client.emit('auth:findOne', authUserList);
    return;
  }
}
