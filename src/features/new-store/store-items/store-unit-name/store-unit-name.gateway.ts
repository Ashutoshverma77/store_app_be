import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { StoreUnitNameService } from './store-unit-name.service';
import { UnitNamePagedQueryDto } from './dto/unit-name.dto';

@WebSocketGateway({ cors: true })
export class StoreUnitNameGateway {
  constructor(private readonly s: StoreUnitNameService) {}

  @SubscribeMessage('store:findAllUnitNamePaged')
  async findAllPaged(
    @ConnectedSocket() client: Socket,
    @MessageBody() q: UnitNamePagedQueryDto,
  ) {
    const data = await this.s.findAllPaged(q || {});
    client.emit('store:findAllUnitNamePaged', data);
  }

  @SubscribeMessage('store:findOneUnitName')
  async findOne(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { id: string },
  ) {
    const data = await this.s.findOne(body?.id);
    client.emit('store:findOneUnitName', data);
  }
}
