// src/item/item.gateway.ts

import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { ItemsService } from './items.service';

@WebSocketGateway({
  cors: { origin: '*' },
})
export class ItemsGateway {
  @WebSocketServer()
  server?: Server;
  constructor(private readonly itemService: ItemsService) {}
  // CLIENT -> SERVER
  @SubscribeMessage('item:findAllItem')
  async handleFindAll() {
    const items = await this.itemService.findAll();
    // SERVER -> CLIENT (broadcast)
    this.server!.emit('item:findAllItem', items);
  }

  // Broadcast after CRUD
  async broadcastItems() {
    const items = await this.itemService.findAll();
    this.server!.emit('item:findAllItem', items);
  }
}
