import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { RacksService } from './rack.service';

@WebSocketGateway({ cors: { origin: '*', credentials: true } })
export class RackGateway {
  constructor(private readonly racks: RacksService) {}

  @SubscribeMessage('store:findAllRackPaged')
  async findAllRackPaged(
    @MessageBody() body: any,
    @ConnectedSocket() client: Socket,
  ) {
    const res = await this.racks.findAllPaged({
      page: Number(body?.page ?? 1),
      limit: Number(body?.limit ?? 12),
      search: String(body?.search ?? ''),
      sort: String(body?.sort ?? '-createdAt'),
      roomId: body?.roomId ? String(body.roomId) : undefined,
    });
    client.emit('store:findAllRackPaged', res);
  }

  @SubscribeMessage('store:findOneRack')
  async findOneRack(
    @MessageBody() body: any,
    @ConnectedSocket() client: Socket,
  ) {
    const id = String(body?.id ?? '');
    const res = await this.racks.findOne(id);
    client.emit('store:findOneRack', res);
  }

  @SubscribeMessage('store:findRackDataByRoomData')
  async findRackByRoom(
    @MessageBody() body: any,
    @ConnectedSocket() client: Socket,
  ) {
    const id = String(body?.roomid ?? '');
    const res = await this.racks.findRackByRoom(id);
    client.emit('store:findRackDataByRoomData', res);
  }

  @SubscribeMessage('store:findRackDataByItemData')
  async findRackByItem(
    @MessageBody() body: any,
    @ConnectedSocket() client: Socket,
  ) {
    const id = String(body?.itemid ?? '');
    const res = await this.racks.findRackByItem(id);
    client.emit('store:findRackDataByItemData', res);
  }

  @SubscribeMessage('store:findNotOccupiedRackPaged')
  async findNotOccupiedRackPaged(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: any,
  ) {
    const data = await this.racks.findNotOccupiedRackPaged({
      page: Number(body?.page ?? 1),
      limit: Number(body?.limit ?? 12),
      search: String(body?.search ?? ''),
      sort: String(body?.sort ?? '-createdAt'),
      roomId: body?.roomId ? String(body.roomId) : undefined,
      allowItemId: body?.allowItemId ? String(body.allowItemId) : undefined,
    });

    console.log(data);

    client.emit('store:findNotOccupiedRackPaged', data);
  }
}
