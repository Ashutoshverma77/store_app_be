import {
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { SizesService } from './sizes.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class SizeGateway {
  @WebSocketServer()
  server: Server;

  constructor(private readonly sizesService: SizesService) {}

  // CLIENT -> SERVER
  @SubscribeMessage('size:findAllSize')
  async handleFindAll(@MessageBody() _data: any) {
    const sizes = await this.sizesService.findAll();
    // SERVER -> CLIENT (all)
    this.server.emit('size:findAllSize', sizes);
  }

  // Called by service after create/update/delete
  async broadcastSizes() {
    const sizes = await this.sizesService.findAll();
    this.server.emit('size:findAllSize', sizes);
  }
}
