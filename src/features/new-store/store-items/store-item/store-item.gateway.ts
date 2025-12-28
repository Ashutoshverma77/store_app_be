import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { StoreItemService } from './store-item.service';
import { ItemPagedQueryDto } from './dto/store-item.dto';

@WebSocketGateway({ cors: true })
export class StoreItemGateway {
  constructor(private readonly s: StoreItemService) {}

  @SubscribeMessage('store:findAllItemPaged')
  async findAllPaged(
    @ConnectedSocket() client: Socket,
    @MessageBody() q: ItemPagedQueryDto,
  ) {
    const data = await this.s.findAllPaged(q || {});
    client.emit('store:findAllItemPaged', data);
  }

  @SubscribeMessage('store:findOneItem')
  async findOne(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { id: string },
  ) {
    const data = await this.s.findOne(body?.id);
    client.emit('store:findOneItem', data);
  }

  @SubscribeMessage('store:sameItemRacks:req')
  async sameItemRacksGet(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: any,
  ) {
    const itemId = String(body?.itemId || '').trim();
    const rows = await this.s.getSameItemRacks(itemId);

    client.emit('store:sameItemRacks:res', rows);
  }
}
