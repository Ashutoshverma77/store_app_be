import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { RoomsService } from './room.service';
import { Socket } from 'socket.io';

@WebSocketGateway({ cors: { origin: '*', credentials: true } })
export class RoomGateway {
  @WebSocketServer() server: any;
  constructor(private readonly rooms: RoomsService) {}

  async broadcastAllRoomList() {
    const list = await this.rooms.findAllPaged({
      page: 1,
      limit: 12,
      search: '',
      sort: 'createdAt',
    });
    this.server.emit('store:findAllRoomPaged', list); // broadcast to all clients
  }
  async broadcastAllRoomScrapList() {
    const list = await this.rooms.findAllPaged({
      page: 1,
      limit: 12,
      search: '',
      sort: 'createdAt',
    });
    this.server.emit('store:findAllScrapRoomPaged', list); // broadcast to all clients
  }

  @SubscribeMessage('store:findAllRoomPaged')
  async findAllRoomPaged(
    @MessageBody() body: any,
    @ConnectedSocket() client: Socket,
  ) {
    const res = await this.rooms.findAllPaged({
      page: Number(body?.page ?? 1),
      limit: Number(body?.limit ?? 12),
      search: String(body?.search ?? ''),
      sort: String(body?.sort ?? 'createdAt'),
    });
    client.emit('store:findAllRoomPaged', res);
  }

  @SubscribeMessage('store:findAllScrapRoomPaged')
  async findAllScrapRoomPaged(
    @MessageBody() body: any,
    @ConnectedSocket() client: Socket,
  ) {
    const res = await this.rooms.findAllScrapRoomPaged({
      page: Number(body?.page ?? 1),
      limit: Number(body?.limit ?? 12),
      search: String(body?.search ?? ''),
      sort: String(body?.sort ?? 'createdAt'),
    });
    client.emit('store:findAllScrapRoomPaged', res);
  }

  @SubscribeMessage('store:findOneRoom')
  async findOneRoom(
    @MessageBody() body: any,
    @ConnectedSocket() client: Socket,
  ) {
    const id = String(body?.id ?? '');
    const res = await this.rooms.findOne(id);
    client.emit('store:findOneRoom', res);
  }

  @SubscribeMessage('store:findAllRoomData')
  async findAllRoom(
    @MessageBody() body: any,
    @ConnectedSocket() client: Socket,
  ) {
    const res = await this.rooms.findAllRoom();
    client.emit('store:findAllRoomData', res);
  }

  @SubscribeMessage('store:findAllRoomDataByScrap')
  async findAllRoomByScrap(
    @MessageBody() body: any,
    @ConnectedSocket() client: Socket,
  ) {
    const res = await this.rooms.findAllRoomByScrap(body.dto);
    client.emit('store:findAllRoomDataByScrap', res);
  }

  @SubscribeMessage('store:findAllRoomDataByGood')
  async findAllRoomByGood(
    @MessageBody() body: any,
    @ConnectedSocket() client: Socket,
  ) {
    const res = await this.rooms.findAllRoomByGood(body.dto);
    client.emit('store:findAllRoomDataByGood', res);
  }
}
