import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateRecipientDto {
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;
}
