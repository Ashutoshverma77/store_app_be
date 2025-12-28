import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { StoreCategoryService } from './store-category.service';
import { CategoryPagedQueryDto } from './dto/store-category.dto';

@WebSocketGateway({ cors: true })
export class StoreCategoryGateway {
  constructor(private readonly s: StoreCategoryService) {}

  @SubscribeMessage('store:findAllCategoryPaged')
  async findAllPaged(
    @ConnectedSocket() client: Socket,
    @MessageBody() q: CategoryPagedQueryDto,
  ) {
    const data = await this.s.findAllPaged(q || {});
    client.emit('store:findAllCategoryPaged', data);
  }

  @SubscribeMessage('store:findOneCategory')
  async findOne(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { id: string },
  ) {
    const data = await this.s.findOne(body?.id);
    client.emit('store:findOneCategory', data);
  }
}
