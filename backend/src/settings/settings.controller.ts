import { Body, Controller, Get, Param, Patch, UseGuards } from "@nestjs/common";
import { Prisma, UserRole } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { JwtAuthGuard, Roles, RolesGuard } from "../common/auth";
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
@Controller("settings")
export class SettingsController {
  constructor(private prisma: PrismaService) {}
  @Get("years/:id") get(@Param("id") id: string) {
    return this.prisma.academicYear.findUnique({
      where: { id: Number(id) },
      include: {
        _count: {
          select: {
            students: true,
            classes: true,
            packages: true,
          },
        },
      },
    });
  }
  @Patch("years/:id/policy") update(
    @Param("id") id: string,
    @Body() b: Record<string, unknown>,
  ) {
    return this.prisma.academicYear.update({
      where: { id: Number(id) },
      data: { policy: b as Prisma.InputJsonValue },
    });
  }
}
