import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { ProblemsService } from './problems.service';

type CreateProblemBody = {
  title?: string;
  prompt?: string;
  example?: string;
  exampleAns?: string;
  testcase?: string;
  testcaseAns?: string;
  authorUserId?: number;
};

@Controller('problems')
export class ProblemsController {
  constructor(private readonly problemsService: ProblemsService) {}

  @Post()
  create(@Body() body: CreateProblemBody) {
    const title = body.title?.trim();
    const prompt = body.prompt?.trim();
    const example = body.example?.trim();
    const exampleAns = body.exampleAns?.trim();
    const testcase = body.testcase?.trim();
    const testcaseAns = body.testcaseAns?.trim();
    const authorUserId = Number(body.authorUserId);

    if (
      !title ||
      !prompt ||
      !example ||
      !exampleAns ||
      !testcase ||
      !testcaseAns ||
      !Number.isInteger(authorUserId)
    ) {
      throw new BadRequestException(
        'title, prompt, example, exampleAns, testcase, testcaseAns, and authorUserId are required.',
      );
    }

    return this.problemsService.create({
      title,
      prompt,
      example,
      exampleAns,
      testcase,
      testcaseAns,
      authorUserId,
    });
  }

  @Get()
  findAll() {
    return this.problemsService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const problemId = Number(id);
    if (!Number.isInteger(problemId)) {
      throw new BadRequestException('id must be a number.');
    }

    const problem = await this.problemsService.findOne(problemId);
    if (!problem) {
      throw new NotFoundException('Problem was not found.');
    }

    return problem;
  }
}
