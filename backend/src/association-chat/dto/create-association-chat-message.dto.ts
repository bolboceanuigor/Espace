import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateAssociationChatMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  text: string;
}
