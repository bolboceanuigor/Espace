import { IsBoolean, IsOptional } from 'class-validator';

export class UpdatePrivacySettingsDto {
  @IsOptional()
  @IsBoolean()
  showResidentNamesInCommunity?: boolean;

  @IsOptional()
  @IsBoolean()
  showApartmentNumbersInCommunity?: boolean;

  @IsOptional()
  @IsBoolean()
  allowResidentsToContactEachOther?: boolean;

  @IsOptional()
  @IsBoolean()
  showIssueReporterName?: boolean;

  @IsOptional()
  @IsBoolean()
  showVoteParticipants?: boolean;
}

