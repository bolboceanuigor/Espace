import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SuperAdminGuard } from '../auth/guards/superadmin.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BackupRecoveryService } from './backup-recovery.service';
import {
  CompleteRecoveryDrillDto,
  CreateProductionIncidentDto,
  CreateRecoveryDrillDto,
  IncidentUpdateDto,
  UpdateBackupChecklistItemDto,
  UpdateProductionIncidentDto,
  UpdateRecoveryDrillDto,
  UpsertBackupCheckDto,
} from './dto/backup-recovery.dto';

@Controller('api/superadmin/backup')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class BackupRecoveryController {
  constructor(private readonly backupRecoveryService: BackupRecoveryService) {}

  @Get()
  overview() {
    return this.backupRecoveryService.overview();
  }

  @Get('checklist')
  checklist() {
    return this.backupRecoveryService.checklist();
  }

  @Post('checklist/run')
  runChecklist(@CurrentUser() user: any) {
    return this.backupRecoveryService.runChecklist(user);
  }

  @Patch('checklist/:id')
  updateChecklist(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateBackupChecklistItemDto) {
    return this.backupRecoveryService.updateChecklistItem(id, dto, user);
  }

  @Get('backup-checks')
  backupChecks() {
    return this.backupRecoveryService.backupChecks();
  }

  @Post('backup-checks')
  createBackupCheck(@CurrentUser() user: any, @Body() dto: UpsertBackupCheckDto) {
    return this.backupRecoveryService.createBackupCheck(dto, user);
  }

  @Get('backup-checks/:id')
  getBackupCheck(@Param('id') id: string) {
    return this.backupRecoveryService.getBackupCheck(id);
  }

  @Patch('backup-checks/:id')
  updateBackupCheck(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpsertBackupCheckDto) {
    return this.backupRecoveryService.updateBackupCheck(id, dto, user);
  }

  @Get('recovery-plan')
  recoveryPlan() {
    return this.backupRecoveryService.recoveryPlan();
  }

  @Get('recovery-drills')
  recoveryDrills() {
    return this.backupRecoveryService.recoveryDrills();
  }

  @Post('recovery-drills')
  createRecoveryDrill(@CurrentUser() user: any, @Body() dto: CreateRecoveryDrillDto) {
    return this.backupRecoveryService.createRecoveryDrill(dto, user);
  }

  @Get('recovery-drills/:id')
  getRecoveryDrill(@Param('id') id: string) {
    return this.backupRecoveryService.getRecoveryDrill(id);
  }

  @Patch('recovery-drills/:id')
  updateRecoveryDrill(@Param('id') id: string, @Body() dto: UpdateRecoveryDrillDto) {
    return this.backupRecoveryService.updateRecoveryDrill(id, dto);
  }

  @Post('recovery-drills/:id/start')
  startRecoveryDrill(@CurrentUser() user: any, @Param('id') id: string) {
    return this.backupRecoveryService.startRecoveryDrill(id, user);
  }

  @Post('recovery-drills/:id/complete')
  completeRecoveryDrill(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: CompleteRecoveryDrillDto) {
    return this.backupRecoveryService.completeRecoveryDrill(id, dto, user);
  }

  @Get('incidents')
  incidents() {
    return this.backupRecoveryService.incidents();
  }

  @Post('incidents')
  createIncident(@CurrentUser() user: any, @Body() dto: CreateProductionIncidentDto) {
    return this.backupRecoveryService.createIncident(dto, user);
  }

  @Get('incidents/:id')
  getIncident(@Param('id') id: string) {
    return this.backupRecoveryService.getIncident(id);
  }

  @Patch('incidents/:id')
  updateIncident(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateProductionIncidentDto) {
    return this.backupRecoveryService.updateIncident(id, dto, user);
  }

  @Post('incidents/:id/updates')
  addIncidentUpdate(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: IncidentUpdateDto) {
    return this.backupRecoveryService.addIncidentUpdate(id, dto, user);
  }

  @Get('export-center')
  exportCenter() {
    return this.backupRecoveryService.exportCenter();
  }
}
