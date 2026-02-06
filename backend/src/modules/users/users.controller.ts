import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateUserBlockDto } from './dto/update-user-block.dto';
import { AdminEndpoint } from '../../auth/admin.decorator';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('ids') ids?: string,
    @Query('role') role?: string,
    @Query('q') q?: string,
  ) {
    const normalizedRole = role === 'admin' || role === 'client' ? role : undefined;
    const normalizedQuery = q?.trim() || undefined;
    const parsedIds = ids
      ?.split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
    if (parsedIds && parsedIds.length > 0) {
      return this.usersService.findByIds(parsedIds);
    }

    const pageNumber = Math.max(1, parseInt(page ?? '1', 10) || 1);
    const limit = Math.min(200, Math.max(10, parseInt(pageSize ?? '50', 10) || 50));
    return this.usersService.findPage({
      page: pageNumber,
      pageSize: limit,
      role: normalizedRole,
      query: normalizedQuery,
    });
  }

  @Get('by-email')
  findByEmail(@Query('email') email?: string) {
    if (!email) return null;
    return this.usersService.findByEmail(email);
  }

  @Get('by-firebase/:firebaseUid')
  findByFirebase(@Param('firebaseUid') firebaseUid: string) {
    return this.usersService.findByFirebaseUid(firebaseUid);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Post()
  create(@Body() data: CreateUserDto) {
    return this.usersService.create(data);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() data: UpdateUserDto) {
    return this.usersService.update(id, data);
  }

  @AdminEndpoint()
  @Patch(':id/block')
  updateBlockStatus(@Param('id') id: string, @Body() data: UpdateUserBlockDto) {
    return this.usersService.setBrandBlockStatus(id, data.blocked);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}
