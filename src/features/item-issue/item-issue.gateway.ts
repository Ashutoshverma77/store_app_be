import {
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { IssueService } from './item-issue.service';

@WebSocketGateway()
export class ItemIssueGateway {
  @WebSocketServer() server: any;
  constructor(private readonly issueService: IssueService) {}

  async broadcastAuthList() {
    const list = await this.issueService.findAll();
    this.server.emit('store:findAllItemIssue', list); // broadcast to all clients
  }

  @SubscribeMessage('store:findAllItemIssue')
  async findAll(client: any, payload: any) {
    var authUserList = await this.issueService.findAll();

    client.emit('store:findAllItemIssue', authUserList);
    return;
  }

  @SubscribeMessage('store:findStatusItemIssue')
  async findStatus(client: any, payload: any) {
    var authUserList = await this.issueService.findStatus(payload.status);

    client.emit('store:findStatusItemIssue', authUserList);
    return;
  }

  @SubscribeMessage('store:findOneItemIssue')
  async findOne(client: any, payload: any) {
    var authUserList = await this.issueService.findOne(payload.id);

    client.emit('store:findOneItemIssue', authUserList);
    return;
  }
}
