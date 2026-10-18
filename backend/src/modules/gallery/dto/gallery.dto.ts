import { ArrayMaxSize, ArrayUnique, IsArray, IsInt, IsString, Matches, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';
import { GALLERY_LIMITS } from '../../../contexts/engagement/domain/services/gallery-policy';

export class GalleryItemDto {
  @IsString() @MinLength(1) @MaxLength(GALLERY_LIMITS.title) title!: string;
  @IsString() @MaxLength(GALLERY_LIMITS.description) description!: string;
  @IsString() @MinLength(1) @MaxLength(191) categoryId!: string;
  @IsString() @Matches(/^[a-zA-Z0-9_-]{1,128}$/) imageFileId!: string;
  @ValidateIf((_, value) => value !== null) @IsString() @Matches(/^[a-zA-Z0-9_-]{1,128}$/) beforeFileId!: string | null;
}
export class UpdateGalleryItemDto extends GalleryItemDto {
  @IsInt() @Min(1) version!: number;
}
export class GalleryCategoryDto {
  @IsString() @MinLength(1) @MaxLength(GALLERY_LIMITS.category) name!: string;
}
export class UpdateGalleryCategoryDto extends GalleryCategoryDto {
  @IsInt() @Min(1) version!: number;
}
export class GalleryVersionDto {
  @IsInt() @Min(1) version!: number;
}
export class GalleryOrderDto {
  @IsArray() @ArrayMaxSize(GALLERY_LIMITS.items) @ArrayUnique() @IsString({ each: true }) @MaxLength(191, { each: true }) expectedIds!: string[];
  @IsArray() @ArrayMaxSize(GALLERY_LIMITS.items) @ArrayUnique() @IsString({ each: true }) @MaxLength(191, { each: true }) orderedIds!: string[];
}
