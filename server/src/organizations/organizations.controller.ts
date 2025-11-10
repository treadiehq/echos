import { Controller, Get, Post, Put, Delete, Body, Param, Req, UseGuards, HttpException, HttpStatus, Inject } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { Request } from 'express';

@Controller('organizations')
@UseGuards(AuthGuard)
export class OrganizationsController {
  constructor(@Inject(OrganizationsService) private organizationsService: OrganizationsService) {}

  @Post()
  async createOrganization(
    @Body() body: { name: string },
    @Req() req: Request
  ) {
    if (!body.name || body.name.trim().length === 0) {
      throw new HttpException('Organization name is required', HttpStatus.BAD_REQUEST);
    }

    const org = await this.organizationsService.createOrganization(
      body.name,
      req.user.id
    );

    return { organization: org };
  }

  @Get()
  async getUserOrganizations(@Req() req: Request) {
    const orgs = await this.organizationsService.getUserOrganizations(req.user.id);
    return { organizations: orgs };
  }

  @Get(':orgId')
  async getOrganization(
    @Param('orgId') orgId: string,
    @Req() req: Request
  ) {
    const isMember = await this.organizationsService.isUserMember(orgId, req.user.id);
    
    if (!isMember) {
      throw new HttpException('Not authorized', HttpStatus.FORBIDDEN);
    }

    const org = await this.organizationsService.getOrganizationById(orgId);
    
    if (!org) {
      throw new HttpException('Organization not found', HttpStatus.NOT_FOUND);
    }

    const role = await this.organizationsService.getUserRole(orgId, req.user.id);

    return { 
      organization: org,
      userRole: role
    };
  }

  @Put(':orgId')
  async updateOrganization(
    @Param('orgId') orgId: string,
    @Body() body: { name?: string },
    @Req() req: Request
  ) {
    const org = await this.organizationsService.updateOrganization(
      orgId,
      req.user.id,
      body
    );

    return { organization: org };
  }

  @Delete(':orgId')
  async deleteOrganization(
    @Param('orgId') orgId: string,
    @Req() req: Request
  ) {
    await this.organizationsService.deleteOrganization(orgId, req.user.id);
    return { success: true };
  }

  @Get(':orgId/members')
  async getMembers(
    @Param('orgId') orgId: string,
    @Req() req: Request
  ) {
    const members = await this.organizationsService.getOrganizationMembers(
      orgId,
      req.user.id
    );

    return { members };
  }

  @Put(':orgId/members/:userId')
  async updateMemberRole(
    @Param('orgId') orgId: string,
    @Param('userId') userId: string,
    @Body() body: { role: 'owner' | 'admin' | 'member' | 'viewer' },
    @Req() req: Request
  ) {
    await this.organizationsService.updateMemberRole(
      orgId,
      userId,
      req.user.id,
      body.role
    );

    return { success: true };
  }

  @Delete(':orgId/members/:userId')
  async removeMember(
    @Param('orgId') orgId: string,
    @Param('userId') userId: string,
    @Req() req: Request
  ) {
    await this.organizationsService.removeMember(
      orgId,
      userId,
      req.user.id
    );

    return { success: true };
  }
}

