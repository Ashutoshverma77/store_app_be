import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import { RoomsService } from './room.service';
import { Socket } from 'socket.io';

@WebSocketGateway({ cors: { origin: '*', credentials: true } })
export class RoomGateway {
  constructor(private readonly rooms: RoomsService) {}

  @SubscribeMessage('store:findAllRoomPaged')
  async findAllRoomPaged(
    @MessageBody() body: any,
    @ConnectedSocket() client: Socket,
  ) {
    const res = await this.rooms.findAllPaged({
      page: Number(body?.page ?? 1),
      limit: Number(body?.limit ?? 12),
      search: String(body?.search ?? ''),
      sort: String(body?.sort ?? '-createdAt'),
    });
    client.emit('store:findAllRoomPaged', res);
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
}
