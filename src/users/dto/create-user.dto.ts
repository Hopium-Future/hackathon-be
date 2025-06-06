import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Min,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @IsNumber()
  @IsInt()
  @Min(1)
  readonly telegramId: number;

  @IsString()
  @IsOptional()
  @MinLength(5)
  readonly username?: string;

  @IsString()
  readonly firstName: string;

  @IsString()
  @IsOptional()
  readonly lastName?: string;

  @IsBoolean()
  @IsOptional()
  allowsWriteToPm?: boolean;

  @IsString()
  @IsOptional()
  languageCode?: string;

  @IsBoolean()
  @IsOptional()
  isPremium?: boolean;

  @IsBoolean()
  @IsOptional()
  addedToAttachmentMenu?: boolean;

  @IsUrl()
  @IsOptional()
  photoUrl?: string;
}
