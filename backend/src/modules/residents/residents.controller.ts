import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { GetActorContext } from '../../common/auth/get-actor-context.decorator';
import { RequestActorContext } from '../../common/auth/request-context.interface';
import { RequestContextGuard } from '../../common/guards/request-context.guard';

@Controller('residents')
@UseGuards(RequestContextGuard)
export class ResidentsController {

  @Post()
  createResident(
    @Body() dto: any,
    @GetActorContext() context: RequestActorContext,
  ) {
    console.log('DTO:', dto);
    console.log('Context:', context);

    return {
      message: 'CreateResident endpoint hit',
      dto,
      context,
    };
  }
}
