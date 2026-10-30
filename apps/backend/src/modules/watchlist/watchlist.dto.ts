import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateTickerDto {
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  symbol: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  exchange?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  assetType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  newsQuery?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;
}

export class UpdateTickerDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  newsQuery?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;
}
