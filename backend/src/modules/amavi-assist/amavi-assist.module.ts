import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/db/prisma.module';
import { AmaviAssistController } from './amavi-assist.controller';
import { AmaviAssistService } from './amavi-assist.service';

@Module({
  imports: [PrismaModule],
  controllers: [AmaviAssistController],
  providers: [AmaviAssistService],
})
export class AmaviAssistModule {}
