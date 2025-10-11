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
    const list = await this.issueService.findPaged({
      page: 1,
      limit: 8,
      search: '',
      sort: '-createdAt',
    });
    this.server.emit('store:findAllItemIssuePaged', list); // broadcast to all clients
  }

  @SubscribeMessage('store:findAllItemIssue')
  async findAll(client: any, payload: any) {
    var authUserList = await this.issueService.findAll();
    client.emit('store:findAllItemIssue', authUserList);
    return;
  }

  // issues.gateway.ts
  @SubscribeMessage('store:findAllItemIssuePaged')
  async findAllItemIssuePaged(client: any, body: any) {
    var authUserList = await this.issueService.findPaged(body);

    client.emit('store:findAllItemIssuePaged', authUserList);
  }

  // src/store/issues.gateway.ts
  @SubscribeMessage('store:findStatusItemIssueApprovedPaged')
  async findStatusApprovedItemIssuePaged(client: any, body: any) {
    var authUserList = await this.issueService.findStatusPaged(body);
    console.log(authUserList);
    client.emit('store:findStatusItemIssueApprovedPaged', authUserList);
  }

  @SubscribeMessage('store:findStatusItemIssueClosePaged')
  async findStatusCloseItemIssuePaged(client: any, body: any) {
    var authUserList = await this.issueService.findStatusPaged(body);
    console.log(authUserList);
    client.emit('store:findStatusItemIssueClosePaged', authUserList);
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

  @SubscribeMessage('issue:listByItem')
  async findListByItem(client: any, payload: any) {
    var authUserList = await this.issueService.findListByItem(payload.itemId);
    client.emit('issue:listByItem', authUserList);
    return;
  }
}
