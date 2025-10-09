import { Controller, Get, Param } from '@nestjs/common';
import { UpdateService } from './update.service';

@Controller('update')
export class UpdateController {
  constructor(private readonly updateService: UpdateService) {}

  @Get('update/:type')
  async getLatestApk(@Param('type') type: string) {
    const latestApk = await this.updateService.cheakVersion(type);

    // return {
    //   version: '3.3.2',
    //   apkUrl: 'https://demo.rrispat.in/public/vb332.apk',
    //   // apkUrl: 'http://192.168.63.24/public/vb332.apk',
    // };

    return {
      version: latestApk!.version,
      apkUrl: latestApk!.apkUrl,
    };
  }
}
// avinash.dewangan@rrispat.com
