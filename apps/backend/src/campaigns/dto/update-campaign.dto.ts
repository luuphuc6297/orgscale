import { ArrayMaxSize, IsArray, IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateCampaignDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(200)
  name?: string;

  @IsOptional() @IsString() @MinLength(1) @MaxLength(255)
  subject?: string;

  @IsOptional() @IsString() @MinLength(1) @MaxLength(102400)
  body?: string;

  @IsOptional() @IsArray() @ArrayMaxSize(1000)
  @IsEmail({}, { each: true })
  recipientEmails?: string[];
}
