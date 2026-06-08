import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('today')
  async getTodayView(
    @Req() request: any,
    @Query('view') view?: string,
  ) {
    const normalizedView =
      view === 'supervisor' ? 'supervisor' : 'staff';
    return this.dashboardService.getTodayView(
      request.actorContext,
      normalizedView,
    );
  }
}
