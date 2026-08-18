# Software Architect Harness (SAH)

[English](README.md) | [한국어](README.ko.md)

SAH는 코딩 에이전트를 위한 방법론 중립적 설계 추론 하네스입니다. 모호한 요구사항을
구현 전에 검토 가능한 아키텍처 근거로 바꾸고, 선택한 아키텍처 제약이 실제 코드에서도
지켜지는지 확인하도록 돕습니다.

한 문장으로 요약하면:

> SAH는 왜 이 설계를 선택했는지, 각 규칙의 책임자는 누구인지, 구현이 무엇을 해야
> 하는지, 그중 무엇을 관찰 가능한 사실로 검증할 수 있는지를 기록합니다.

현재 SAH는 1.0 이전의 로컬 우선 TypeScript 프로젝트입니다. GitHub 저장소는
공개되어 있지만 npm 패키지는 private이므로 소스 체크아웃에서 실행해야 합니다.

## 왜 SAH가 필요한가요?

코딩 에이전트는 동작하는 코드를 만들면서도 다음과 같은 비싼 구조적 실수를 할 수
있습니다.

- 모든 서브시스템에 같은 방법론을 적용한다.
- 근거 없이 레이어, 서비스, 인터페이스, 이벤트를 추가한다.
- 경계나 의존성 방향을 정한 이유를 잃어버린다.
- 주관적인 아키텍처 판단을 결정론적 규칙처럼 취급한다.
- 코드를 변경하면서 어떤 이전 결정을 다시 검토해야 하는지 알지 못한다.

SAH는 요구사항과 구현 사이에 근거의 연결 고리를 만듭니다. 하나의 아키텍처 스타일을
강요하지 않습니다. 단순 CRUD 영역은 단순하게 유지하고, 결제·파이프라인·에이전트
영역은 실제 위험이 요구할 때만 더 강한 경계를 사용하게 합니다.

코딩 에이전트가 중요한 구조 변경을 수행하고, 다음 에이전트가 그 결정을 이해하거나
보존해야 할 때 SAH가 유용합니다. 작고 되돌리기 쉬운 저위험 변경에는 short profile을
사용해 문서화 비용을 줄일 수 있습니다.

## 먼저 이해할 세 가지

SAH는 세 가지 대상을 중심으로 작동합니다.

1. **설계 번들** — 근거, 책임, 불변조건, 아키텍처, 결정, 구현 인수인계를 담은
   스키마 검증 JSON 파일 묶음입니다.
2. **대상 체크아웃** — 검증할 코드 또는 산출물이 있는 디렉터리입니다.
3. **라이프사이클** — S0부터 S13까지의 단계입니다. 각 gate가 잘못된 근거가 완료
   상태로 넘어가지 못하게 막습니다.

~~~mermaid
flowchart LR
    A[요구사항과 저장소 근거] --> B[설계 추론 S0-S12]
    B --> C[설계 번들과 구현 인수인계]
    C --> D[sah validate]
    C --> E[대상 구현]
    C --> F[sah verify]
    E --> F
    F --> G[Full verification record]
    G --> H[S13으로 advance]
~~~

이 흐름은 일방향 폭포수가 아닙니다. 나중에 발견한 근거가 이전 가정을 뒤집으면 가장
이른 영향 단계로 돌아가고, 그 이후의 추론을 stale 상태로 다시 검토합니다.

### S0–S13을 다섯 단계로 보기

| 구간 | Stage | 핵심 질문 | 주요 산출물 |
| --- | --- | --- | --- |
| 문제 이해 | S0–S2 | 어떤 문제이며 각 영역에 어떤 전략이 맞는가? | 시스템 특성화와 설계 전략 |
| 책임 배정 | S3–S5 | 어떤 책임과 불변조건이 있고 누가 소유하는가? | Responsibility와 Invariant |
| 아키텍처 설계 | S6–S10 | 어떤 경계·표현·후보가 측정 가능한 품질 요구를 가장 잘 만족하는가? | Architecture와 승인된 Decision |
| 구현 준비 | S11–S12 | 어떤 주장을 검사할 수 있으며 코딩 에이전트는 어떤 순서로 변경해야 하는가? | Constraint와 Implementation Handoff |
| 지속 검증 | S13 | 구현이 승인된 관찰 가능 제약을 계속 만족하는가? | 검증 증거와 라이프사이클 완료 |

각 stage의 입력, gate, 되돌아가는 조건은
[설계 추론 모델](docs/design-reasoning-model.md)이 정확히 정의합니다.

## 설계 번들에는 무엇이 들어가나요?

루트 manifest 이름은 sah.bundle.json입니다. 번들 ID, 완료 stage, profile을 기록하고
lifecycle이 진행되면서 다음 일곱 개의 의미론적 IR(Intermediate Representation, 중간
표현) 파일을 가리킬 수 있습니다.

| 산출물 | 답하는 질문 |
| --- | --- |
| System Characterization | 범위와 근거는 무엇이고 어떤 품질 시나리오가 중요한가? |
| Design Strategy | 각 문제 영역에 어떤 전략이 맞으며 더 단순한 대안과 결정 반전 조건은 무엇인가? |
| Responsibility | 어떤 결과가 필요하고 왜 변경되며 누구와 협업하는가? |
| Invariant | 무엇이 어느 범위에서 언제까지 참이어야 하며 실패를 어떻게 탐지·복구하는가? |
| Architecture | 어떤 요소, 경계, 관계, 후보, 실행 가능한 제약이 있는가? |
| Architecture Decision | 어떤 선택을 승인했고 어떤 대안을 거절했으며 비용과 재검토 조건은 무엇인가? |
| Implementation Handoff | 에이전트가 어떤 의존 순서로 코드·검사·마이그레이션·롤백을 수행하는가? |

[schemas](schemas/) 아래 JSON Schema가 기계 계약입니다. Markdown과 다이어그램은 이해를
돕지만 JSON을 대신하지 않습니다. 안정적인 ID가 근거 → 전략 → 책임/불변조건 →
아키텍처 → 결정 → 제약 → 구현 slice를 연결합니다.

Manifest와 verification record는 운영 메타데이터이며 의미론적 IR을 추가한 것이
아닙니다. 정확한 소유권은 [구조화 아키텍처 모델](docs/architecture-model.md)을
참고하세요.

## SAH는 무엇을 자동으로 강제할 수 있나요?

SAH는 검증 가능성에 따라 주장을 나눕니다.

| 분류 | 의미 | 자동 hard fail 가능 여부 |
| --- | --- | --- |
| Deterministic | 완전한 관찰 입력과 고정된 판정식이 있음 | 필요한 adapter가 있을 때 가능 |
| Assisted | 사실이 맥락 검토 범위를 좁힘 | 불가, finding만 생성 |
| Judgment | 사람 또는 LLM이 rubric, confidence, 반대 근거를 함께 평가 | 불가, disposition 전까지 pending |

Adapter가 없으면 **unsupported**이며 pass가 아닙니다. 이름 냄새, 추상화 선택, 전략 적합성,
트레이드오프 판단은 규칙처럼 표현하기 쉽다는 이유만으로 결정론적 오류가 되지 않습니다.

현재 실행 가능한 adapter는 다음 두 가지입니다.

- 선언한 대상 상대 경로에 일반 파일이 존재하는지 확인
- 명시적으로 mapping한 TypeScript write symbol의 직접 호출자가 constraint에서 허용한
  아키텍처 element에 속하는지 확인

전체 분류 계약과 한계는 [검증 모델](docs/validation-model.md)에 있습니다.

## 5분 만에 실행해 보기

### 1. Clone과 설치

Node.js 22 이상과 npm이 필요합니다.

~~~sh
git clone https://github.com/2000silpeed/sah.git
cd sah
npm install
npm run build
~~~

전역 설치는 필요 없습니다. npm exec가 현재 체크아웃에서 빌드한 binary를 실행합니다.

### 2. 예제 설계 번들 검증

~~~sh
npm exec -- sah validate fixtures/simple-crud
~~~

예상 결과:

~~~text
SAH validation passed

Bundle: equipment-register (S12, short)

Summary: 0 error(s), 0 warning(s)
~~~

이 결과는 JSON이 schema에 맞고, 참조가 연결되며, manifest에 저장된 S12 상태에 필요한
모든 gate가 통과했음을 뜻합니다. 아직 대상 코드는 검사하지 않았습니다.

다른 도구나 에이전트가 결과를 읽어야 하면 --json을 추가하세요.

~~~sh
npm exec -- sah validate fixtures/simple-crud --json
~~~

### 3. 예제 TypeScript 대상 검증

~~~sh
npm exec -- sah verify fixtures/simple-crud fixtures/s13-typescript-target --mapping sah.source-map.json
~~~

예상 결과는 equipment-owns-writes constraint의 결정론적 check 하나가 pass하는 것입니다.

각 인자의 의미:

- fixtures/simple-crud: 설계 번들
- fixtures/s13-typescript-target: 검증 대상 체크아웃
- sah.source-map.json: 대상 체크아웃 기준 상대 경로이며 source path/symbol을 Architecture
  element ID에 연결하는 mapping

--record를 지정하지 않은 verify는 읽기 전용입니다.

## Full evidence를 기록하고 S13 완료하기

advance는 sah.bundle.json을 변경합니다. 체크인된 fixture에서 직접 실험하지 말고 복사본을
만드세요.

~~~sh
bundle_root="$(mktemp -d)"
cp -R fixtures/simple-crud "$bundle_root/bundle"

npm exec -- sah verify "$bundle_root/bundle" fixtures/s13-typescript-target --mapping sah.source-map.json --record verification-record.json --json

npm exec -- sah advance "$bundle_root/bundle" S13 --verification-record verification-record.json --json

npm exec -- sah validate "$bundle_root/bundle" --json
~~~

내부에서 일어난 일:

1. verify가 S12 번들을 검증하고 할당된 모든 constraint를 실행합니다.
2. --record가 전체 결과와 design fingerprint를 번들 내부에 원자적으로 저장합니다.
3. advance가 record, coverage, 정확한 byte, 현재 design을 다시 검증합니다.
4. manifest 한 번의 원자적 교체로 completedStage=S13과 고정된 record descriptor를 함께
   기록합니다.
5. 마지막 validate가 저장된 S13 상태를 다시 확인합니다.

Record를 저장하는 것만으로 lifecycle이 진행되지는 않습니다. Schema가 유효한 **full**
record이면서 결과가 passed이고, S12 assignment coverage가 완전하며, 모든 결정론적 check가
pass하고, design fingerprint가 현재 상태와 일치해야 S12→S13을 승인할 수 있습니다.

### Changed-scoped 검증은 빠른 피드백용입니다

명시한 대상 상대 경로가 영향을 주는 slice의 constraint만 실행하려면 --changed를
사용합니다.

~~~sh
npm exec -- sah verify fixtures/simple-crud fixtures/s13-typescript-target --mapping sah.source-map.json --changed src/equipment-operations/save-equipment.ts --json
~~~

SAH는 Git 상태를 읽지 않습니다. 변경된 모든 경로를 직접 전달해야 합니다. 경로가
mapping되지 않았거나 모호하거나 선언한 source root 밖이면 full-fallback으로 확장됩니다.

선택한 check가 모두 pass하거나 fallback이 전체 check를 실행했더라도 호출 자체는 여전히
change-scoped evidence입니다. S13 완료 증거가 될 수 없습니다. --changed 없이 새로운 full
verification을 실행해야 합니다.

## CLI 빠른 참조

| 명령 | 용도 | 파일 변경 |
| --- | --- | --- |
| sah validate BUNDLE | 저장된 lifecycle stage 기준으로 번들 검증 | 없음 |
| sah verify BUNDLE TARGET | 번들 검증 후 대상 fact 검사 | --record가 없으면 없음 |
| sah advance BUNDLE STAGE | 정확히 다음 gate를 검증하고 lifecycle을 원자적으로 변경 | 성공한 경우에만 있음 |

Advance는 정방향으로 정확히 한 stage만 이동합니다. 현재 실행 가능한 target gate는
S5부터 S13까지입니다.

~~~text
sah validate <design-bundle-directory> [--json]
sah advance <design-bundle-directory> <target-stage> [--verification-record <bundle-relative-record>] [--json]
sah verify <design-bundle-directory> <target-directory> [--mapping <target-relative-mapping-file>] [--changed <target-relative-file>]... [--record <bundle-relative-record>] [--json]
~~~

주요 option:

| Option | 의미 |
| --- | --- |
| --json | 설명 없이 JSON result 하나만 출력 |
| --mapping PATH | 대상 내부의 명시적 TypeScript mapping 설정 사용 |
| --changed PATH | 변경 파일 기준 affected constraint 선택, 반복 가능하며 --mapping 필요 |
| --record PATH | 안전한 번들 상대 JSON 경로에 verification record 저장 |
| --verification-record PATH | S12→S13 advance에서 해당 번들 상대 record 사용 |

CLI exit code:

| Exit | 의미 |
| ---: | --- |
| 0 | Validation 통과, advance commit 완료, 또는 선택한 verification check 전체 통과 |
| 1 | 유효한 입력에 validation/gate 결함이 있거나 advance가 blocked되었거나 deterministic constraint 위반 |
| 2 | 호출/운영 실패 또는 review, blocker, unsafe binding, adapter가 남아 verification incomplete |

Result envelope, 전이 규칙, 경로 제한, adapter 범위, 원자성의 기준 문서는
[Validation CLI and Library](docs/validation-cli.md)입니다.

## 내 프로젝트에 적용하기

현재 runtime은 설계 근거를 validate, advance, verify하지만 S0–S12 번들을 자동으로
scaffold하거나 작성하지는 않습니다. Schema와 예제에서 시작하세요.

1. 프로젝트 안에 별도의 design 디렉터리를 만듭니다.
2. sah.bundle.json과 현재 stage에 필요한 의미론적 IR 파일을 추가합니다.
   [fixtures/simple-crud](fixtures/simple-crud/)는 파일 형태의 예제로만 사용하고 그
   아키텍처를 정답처럼 복사하지 마세요.
3. [설계 추론 모델](docs/design-reasoning-model.md)의 S0–S12를 따라 주장보다 근거를 먼저
   기록하고, 해결되지 않은 decision은 proposed로 유지합니다.
4. 중요한 편집마다 sah validate를 실행합니다. 마지막 문서만 고치지 말고 가장 이른
   잘못된 전제로 돌아가세요.
5. implementation-handoff.json의 의존 순서에 따라 slice를 구현합니다.
6. TypeScript 검증을 사용한다면 대상 내부 mapping에 tsconfig, 전체 source root,
   path-to-element ownership, write target symbol을 명시합니다.
   [Mapping schema](schemas/typescript-source-mapping.schema.json)를 따르세요.
7. Full verification 결과를 기록하고, 자격이 있는 check가 모두 통과했을 때만 S13으로
   advance합니다.

중요한 아키텍처 작업에는 full profile을 사용하세요. Short profile은 되돌리기 쉽고,
로컬이며, critical invariant·분산·확률적 자율성·중요한 품질 시나리오가 없는 저위험
작업에만 맞습니다.

## Library로 통합하기

CLI와 같은 경계가 TypeScript library로도 제공됩니다.

~~~ts
import {
  advanceBundle,
  validateBundle,
  verifyBundle,
  type VerificationOptions,
} from "software-architect-harness";

const validation = await validateBundle("design/equipment");

const options = {
  sourceMappingPath: "sah.source-map.json",
  verificationRecordPath: "verification-record.json",
} satisfies VerificationOptions;

const verification = await verifyBundle(
  "design/equipment",
  "target/equipment",
  options,
);

const advancement = await advanceBundle("design/equipment", "S13", {
  verificationRecordPath: "verification-record.json",
});
~~~

예상 가능한 실패는 throw 대신 type이 있는 result status로 반환됩니다. Public contract는
Ajv, TypeScript compiler, filesystem, Git, CLI parser type을 노출하지 않습니다. 패키지는
아직 npm에 게시되지 않았으므로 위 코드는 registry 설치법이 아니라 통합 surface 예시입니다.

## 실패 결과 읽는 법

먼저 status를 보고 diagnostic 또는 check code를 확인하세요.

- **violations / exit 1** — 입력을 정상적으로 읽었지만 schema, gate, reference, 대상
  fact와 모순됩니다. expected와 repair를 따라가세요.
- **incomplete / exit 2** — review, blocker, adapter, 지원하지 않는 source form 때문에
  pass/violation을 정직하게 결론 낼 수 없습니다.
- **operational-error / exit 2** — 호출, 경로 안전성, I/O, parsing, 설정에 실패했습니다.
  아키텍처를 해석하기 전에 실행 문제부터 고치세요.
- **blocked / exit 1** — 다음 stage 후보를 평가했지만 gate를 통과하지 못했습니다.
  Manifest는 이전 stage에 그대로 남습니다.

초보자가 자주 하는 실수:

- 체크인된 fixture에서 advance 실행
- --changed가 Git 상태를 자동으로 읽는다고 가정
- changed-scoped pass를 S13 완료 증거로 사용
- TypeScript source-graph constraint에서 --mapping 누락
- unsupported를 pass로 해석
- canonical JSON은 모순된 채 Markdown만 수정
- lifecycle stage 건너뛰기

## 저장소 구조

- [schemas](schemas/) — canonical JSON IR과 verification contract
- [src](src/) — CLI/library runtime, gate, atomic manifest update, fact adapter
- [test](test/) — schema, stage, CLI, atomicity, adversarial verification test
- [fixtures](fixtures/) — benchmark 입력과 분리된 안전한 실행 예제
- [benchmarks](benchmarks/) — 방법론 판별 case와 숨겨진 expectation
- [docs](docs/) — 제품, 추론, 아키텍처, 검증, ADR 권위 문서
- [.agent/PLANS.md](.agent/PLANS.md) — 실행 이력, 발견, 검증 근거
- [AGENTS.md](AGENTS.md) — Codex와 다른 코딩 에이전트의 영구 정책
- [CLAUDE.md](CLAUDE.md) — 같은 정책을 import하는 Claude Code 진입점

Bootstrap prompt는 provenance input으로 보존되며 현재 제품 권위가 아닙니다.

## SAH 개발과 전체 검증

Commit 전에 전체 로컬 품질 검사를 실행합니다.

~~~sh
npm install
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm run verify:schemas
~~~

현재 suite는 225개 test를 포함합니다. 정확한 실행 검증 slice, 파일 규율, 문서 line budget,
변경 workflow는 [AGENTS.md](AGENTS.md)가 소유합니다.

## 현재 범위와 한계

SAH는 범용 방법론, 코드 생성기, source-code reverse-engineering 제품, diagram editor,
일반 project-management 시스템이 아닙니다. 현재 다음 기능은 제공하지 않습니다.

- Hosted coordination
- 범용 evidence database
- Git 변경 자동 탐지
- 일반 source graph 또는 predicate 실행
- 자동 LLM/human judgment 실행
- npm에 게시된 package

빠진 기능은 명시적 backlog 또는 incomplete coverage로 남으며 pass를 만들어내지 않습니다.

## 다음에 읽을 문서

- [문서 인덱스](docs/index.md) — 각 개념의 권위 문서 안내
- [Vision](docs/vision.md) — 대상 사용자, 결과, 성공 기준, non-goal
- [설계 추론 모델](docs/design-reasoning-model.md) — 정확한 S0–S13 계약
- [Validation CLI and Library](docs/validation-cli.md) — 명령, result, exit, atomicity
- [Harness architecture](docs/harness-architecture.md) — component boundary와 dependency rule
- [Dogfood walkthrough](docs/dogfood.md) — SAH를 직접 적용하며 발견한 구체적 reasoning repair
