import { Controller, Get, Query, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { AuthenticatedRequest } from "../../common/current-user";
import { SearchService } from "./search.service";

@ApiTags("search")
@Controller("search")
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get()
  findAll(@Req() request: AuthenticatedRequest, @Query("q") query = "", @Query("limit") limit = "5") {
    return this.search.search(request.user, query, Number(limit) || 5);
  }
}
