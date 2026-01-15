import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { RacksService } from './rack.service';

@WebSocketGateway({ cors: { origin: '*', credentials: true } })
export class RackGateway {
  @WebSocketServer() server: any;
  constructor(private readonly racks: RacksService) {}

  async broadcastAllRackList(body: any) {
    const list = await this.racks.findAllPaged({
      page: 1,
      limit: 12,
      search: '',
      sort: 'createdAt',
      roomId: body?.roomId ? String(body.roomId) : undefined,
    });
    this.server.emit('store:findAllRackPaged', list); // broadcast to all clients
  }
  async broadcastAllRackScrapList(body: any) {
    const list = await this.racks.findAllPaged({
      page: 1,
      limit: 12,
      search: '',
      sort: 'createdAt',
      roomId: body?.roomId ? String(body.roomId) : undefined,
    });
    this.server.emit('store:findAllScrapRackPaged', list); // broadcast to all clients
  }

  @SubscribeMessage('store:findRealAllRackPaged')
  async findRealAllRackPaged(
    @MessageBody() body: any,
    @ConnectedSocket() client: Socket,
  ) {
    const res = await this.racks.findRealAllRackPaged();
    client.emit('store:findRealAllRackPaged', res);
  }

  @SubscribeMessage('store:findAllRackPaged')
  async findAllRackPaged(
    @MessageBody() body: any,
    @ConnectedSocket() client: Socket,
  ) {
    const res = await this.racks.findAllPaged({
      page: Number(body?.page ?? 1),
      limit: Number(body?.limit ?? 12),
      search: String(body?.search ?? ''),
      sort: String(body?.sort ?? 'createdAt'),
      roomId: body?.roomId ? String(body.roomId) : undefined,
    });
    client.emit('store:findAllRackPaged', res);
  }

  @SubscribeMessage('store:findAllScrapRackPaged')
  async findAllScrapRackPaged(
    @MessageBody() body: any,
    @ConnectedSocket() client: Socket,
  ) {
    const res = await this.racks.findAllScrapRackPaged({
      page: Number(body?.page ?? 1),
      limit: Number(body?.limit ?? 12),
      search: String(body?.search ?? ''),
      sort: String(body?.sort ?? 'createdAt'),
      roomId: body?.roomId ? String(body.roomId) : undefined,
    });
    client.emit('store:findAllScrapRackPaged', res);
  }

  @SubscribeMessage('store:findAllGoodMachineRackPaged')
  async findAllGoodMachineRackPaged(
    @MessageBody() body: any,
    @ConnectedSocket() client: Socket,
  ) {
    const res = await this.racks.findAllGoodMachineRackPaged({
      page: Number(body?.page ?? 1),
      limit: Number(body?.limit ?? 12),
      search: String(body?.search ?? ''),
      sort: String(body?.sort ?? 'createdAt'),
      roomId: body?.roomId ? String(body.roomId) : undefined,
    });
    client.emit('store:findAllGoodMachineRackPaged', res);
  }

  @SubscribeMessage('store:findAllScrapMachineRackPaged')
  async findAllScrapMachineRackPaged(
    @MessageBody() body: any,
    @ConnectedSocket() client: Socket,
  ) {
    const res = await this.racks.findAllScrapMachineRackPaged({
      page: Number(body?.page ?? 1),
      limit: Number(body?.limit ?? 12),
      search: String(body?.search ?? ''),
      sort: String(body?.sort ?? 'createdAt'),
      roomId: body?.roomId ? String(body.roomId) : undefined,
    });
    client.emit('store:findAllScrapMachineRackPaged', res);
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

  @SubscribeMessage('store:findRackDataByItemDataNonZeroStock')
  async findRackByItemNonZero(
    @MessageBody() body: any,
    @ConnectedSocket() client: Socket,
  ) {
    const id = String(body?.itemid ?? '');
    const res = await this.racks.findRackByItemNonZero(id);
    client.emit('store:findRackDataByItemDataNonZeroStock', res);
  }

  @SubscribeMessage('store:findRackStock')
  async findRackStock(
    @MessageBody() body: any,
    @ConnectedSocket() client: Socket,
  ) {
    const id = String(body?.rackid ?? '');
    const res = await this.racks.findRackStock(id);
    client.emit('store:findRackStock', res);
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

    client.emit('store:findNotOccupiedRackPaged', data);
  }
}
