import { ArrayMaxSize, ArrayMinSize, IsArray, IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateCampaignDto {
  @IsString() @MinLength(1) @MaxLength(200)
  name!: string;

  @IsString() @MinLength(1) @MaxLength(255)
  subject!: string;

  @IsString() @MinLength(1) @MaxLength(102400)
  body!: string;

  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(1000)
  @IsEmail({}, { each: true })
  recipientEmails!: string[];
}
