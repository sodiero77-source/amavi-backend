import {
  BadGatewayException,
  Injectable,
  InternalServerErrorException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Anthropic from "@anthropic-ai/sdk";
import { GenerateNoteDto, SoapNoteResponse } from "./dto";

@Injectable()
export class AiService {
  private readonly anthropic: Anthropic;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>("ANTHROPIC_API_KEY");

    if (!apiKey) {
      throw new InternalServerErrorException(
        "ANTHROPIC_API_KEY is not configured",
      );
    }

    this.anthropic = new Anthropic({ apiKey });
  }

  async generateNote(dto: GenerateNoteDto): Promise<SoapNoteResponse> {
    const message = await this.anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 800,
      temperature: 0.2,
      system:
        "You write concise clinical SOAP notes. Return only valid JSON with string fields: subjective, objective, assessment, plan.",
      messages: [
        {
          role: "user",
          content: JSON.stringify({
            residentContext: dto.residentContext,
            mood: dto.mood,
            intervention: dto.intervention,
            observations: dto.observations,
          }),
        },
      ],
    });

    const text = message.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();

    try {
      return this.parseSoapNote(text);
    } catch {
      throw new BadGatewayException(
        "Anthropic returned an invalid SOAP note response",
      );
    }
  }

  private parseSoapNote(text: string): SoapNoteResponse {
    const parsed = JSON.parse(text) as Partial<SoapNoteResponse>;

    if (
      typeof parsed.subjective !== "string" ||
      typeof parsed.objective !== "string" ||
      typeof parsed.assessment !== "string" ||
      typeof parsed.plan !== "string"
    ) {
      throw new Error("Invalid SOAP note shape");
    }

    return {
      subjective: parsed.subjective,
      objective: parsed.objective,
      assessment: parsed.assessment,
      plan: parsed.plan,
    };
  }
}
