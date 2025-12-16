import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { BagsService } from './bags.service';

@WebSocketGateway({
  cors: { origin: '*', credentials: true },
})
export class BagGateway {
  @WebSocketServer()
  server: Server;

  constructor(private readonly bagsService: BagsService) {}

  @SubscribeMessage('bag:findAllBag')
  async onFindAllBags(client: Socket, data: any) {
    const bags = await this.bagsService.findAll();
    client.emit('bag:findAllBag', bags); // ✅ respond
  }

  async emitAllBags() {
    const bags = await this.bagsService.findAll();
    this.server.emit('bag:findAllBag', bags); // ✅ broadcast after changes
  }
}
