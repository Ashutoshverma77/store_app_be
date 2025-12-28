import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { StoreItemNameService } from './store-item-name.service';
import { ItemNamePagedQueryDto } from './dto/item-name.dto';

@WebSocketGateway({ cors: true })
export class StoreItemNameGateway {
  constructor(private readonly s: StoreItemNameService) {}

  @SubscribeMessage('store:findAllItemNamePaged')
  async findAllPaged(
    @ConnectedSocket() client: Socket,
    @MessageBody() q: ItemNamePagedQueryDto,
  ) {
    const data = await this.s.findAllPaged(q || {});
    client.emit('store:findAllItemNamePaged', data);
  }

  @SubscribeMessage('store:findOneItemName')
  async findOne(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { id: string },
  ) {
    const data = await this.s.findOne(body?.id);
    client.emit('store:findOneItemName', data);
  }
}
