import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { StoreCategoryService } from './store-category.service';
import { CategoryPagedQueryDto } from './dto/store-category.dto';

@WebSocketGateway({ cors: true })
export class StoreCategoryGateway {
  @WebSocketServer() server: any;
  constructor(private readonly s: StoreCategoryService) {}

  async broadcastAllRoomList() {
    const list = await this.s.findAllPaged({
      page: 1,
      limit: 12,
      search: '',
      sort: '-createdAt',
    });
    this.server.emit('store:findAllCategoryPaged', list); // broadcast to all clients
  }

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

  @SubscribeMessage('store:parentcategory')
  async findperent(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { id: string },
  ) {
    const data = await this.s.findperent();
    client.emit('store:parentcategory', data);
  }

  @SubscribeMessage('store:categoryByIdperent')
  async findchild(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { id: string },
  ) {
    console.log(body);
    const data = await this.s.findchild(body?.id);

    console.log(data);

    client.emit('store:categoryByIdperent', data);
  }
}
