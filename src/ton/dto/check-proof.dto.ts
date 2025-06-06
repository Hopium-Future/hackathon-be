import {
  IsEnum,
  IsNumber,
  IsPositive,
  IsString,
  ValidateNested,
} from 'class-validator';
import { TON_CHAIN } from '../constants';
import { ApiProperty } from '@nestjs/swagger';

class Domain {
  @IsNumber()
  @ApiProperty()
  @IsPositive()
  lengthBytes: number;

  @ApiProperty()
  @IsString()
  value: string;
}

class Proof {
  @ApiProperty()
  @IsNumber()
  timestamp: number;

  @ApiProperty()
  @ValidateNested()
  domain: Domain;

  @ApiProperty()
  @IsString()
  payload: string;

  @ApiProperty()
  @IsString()
  signature: string;

  @ApiProperty()
  @IsString()
  stateInit: string;
}

export class CheckProofDto {
  @ApiProperty()
  @IsString()
  address: string;

  @ApiProperty()
  @IsString()
  @IsEnum(TON_CHAIN)
  network: string;

  @ApiProperty()
  @IsString()
  publicKey: string;

  @ApiProperty()
  @ValidateNested()
  proof: Proof;
}
