# QUY_TAC_BAT_BUOC — CORE GOVERNANCE v3

## 1. Authority

- Release version authority: `SOURCE/VERSION`.
- Human governance authority: this file, `SOURCE/QUY_TAC_BAT_BUOC.md`.
- Project purpose authority: `SOURCE/MUC_TIEU_DU_AN.md`.
- Current execution/development state: `SOURCE/PROJECT_STATE.md`, subordinate to verified physical truth.
- Machine checker implementation may enforce or explain these rules but may not silently create new human rules.

This v3 rulebook intentionally replaces the v2 model of 56 universally mandatory rules with **10 contiguous core rules: `QT001` through `QT010`**.

The core exists to make projects easier to read, change and maintain. Specialized controls belong to project-specific profiles when the relevant capability or risk exists.

### North Star

> **Quy tắc tồn tại để giúp mã nguồn dễ đọc, dễ tìm, dễ sửa, dễ nâng cấp, hạn chế file quá lớn và trách nhiệm chồng chéo. Quy tắc là guardrail hỗ trợ phát triển, không phải gate làm chậm phát triển.**

Nguyên tắc diễn giải đi kèm:

> **Ưu tiên chất lượng kiến trúc và khả năng bảo trì hơn việc “PASS checker”. Không được sửa code chỉ để làm checker xanh nếu việc đó làm kiến trúc tệ hơn.**

## 2. Enforcement philosophy

Governance cost must be proportional to risk.

A rule is useful only when it prevents a concrete defect, reduces meaningful risk, or materially improves maintainability. More rules, more evidence, more test cases or more documents do not automatically mean higher quality.

Machine enforcement should prefer:

- deterministic checks over speculative inference;
- actionable output over compliance scoring;
- targeted verification over unrelated full-project ceremony;
- warnings for maintainability issues;
- blocking failures only for concrete high-risk violations.

Canonical statuses for v3 machine reporting are:

- `PASS`: the checked requirement is satisfied.
- `WARN`: a maintainability or quality concern exists but normal development is not blocked.
- `FAIL`: a concrete violation creates material correctness, safety, integrity or maintainability risk.
- `REVIEW`: human/architectural judgment is required; this is not automatically a failure.

There is no mandatory "100/100" compliance score.

### Phạm vi enforcement mặc định

Governance v3 là **change-local và risk-local theo mặc định**:

- Một thay đổi nhỏ không phải sửa toàn bộ technical debt có sẵn của project trước khi được tiếp tục.
- Debt nằm ngoài phần được sửa và ngoài consumer/impact liên quan nên được ghi `WARN`, `REVIEW` hoặc backlog; chỉ block khi nó tạo concrete material risk cho thay đổi hiện tại hoặc cho current runtime/source truth.
- Verifier có thể chạy **FULL** hoặc **SCOPED**. SCOPED chỉ dùng deterministic source checks trên changed/affected paths được chỉ định; debt ngoài scope không được biến thành blocking failure cho thay đổi local.
- SCOPED PASS không phải full-project conformance. Release/audit toàn source vẫn dùng FULL khi risk hoặc release contract yêu cầu.
- Không được biến một warning maintainability thành project-wide refactor bắt buộc chỉ để checker xanh.
- `Bắt buộc` là semantics normative của rule; `Khuyến nghị`, `Ví dụ` và machine heuristic không tự trở thành blocking gate.
- Machine `overall=PASS` chỉ có nghĩa **không có `FAIL` concrete**. Nó không có nghĩa mọi `WARN` đã xử lý hoặc mọi `REVIEW` đã được con người chấp thuận.

---

# 3. Core rules

Mỗi rule dùng cùng một cấu trúc để người và AI áp dụng nhanh khi code:

`Mục tiêu → Khi code cần làm gì → Không được làm gì → WARN / REVIEW khi → FAIL khi → Ví dụ thực tế`.

Các ví dụ là guidance để hiểu rule, không phải pattern bắt buộc cho mọi project.

## QT001 — CANONICAL_TRUTH_AND_OWNERSHIP

**Mục tiêu:** mỗi concern quan trọng có một source of truth và một owner rõ ràng, để không phải đoán file nào đúng.

**Khi code cần làm gì:**

- Chỉ định một canonical owner cho version, config, schema, contract hoặc business truth quan trọng.
- Khi thay owner, retire/supersede owner cũ rõ ràng.
- Nếu declared state mâu thuẫn với verified physical current state, dùng physical current state.
- Derived/generated/read-only copy được phép nếu owner gốc và cách đồng bộ/validate rõ.

**Không được làm gì:**

- Không duy trì hai authored authorities độc lập cùng sở hữu một truth.
- Không copy version/config/schema sang nhiều file rồi sửa tay từng nơi.
- Không ép mọi project phải có cùng workspace, database, VCS, CI hay receipt system chỉ để chứng minh authority.

**WARN / REVIEW khi:** ownership khó xác định, có nhiều bản copy nhưng chưa chứng minh được chúng cạnh tranh authority.

**FAIL khi:** có nhiều active authored sources có thể đưa ra truth khác nhau cho cùng một concern material.

**Ví dụ thực tế:** `pricing_rules.json` là owner giá; UI chỉ đọc/derive từ đó. Không tạo thêm `pricing_rules_ui.json` rồi sửa tay song song.

---

## QT002 — CLEAR_NAMING_AND_DISCOVERABILITY

**Mục tiêu:** nhìn tên file/module/function/type là đoán được trách nhiệm và tìm được implementation nhanh.

**Khi code cần làm gì:**

- Đặt tên theo responsibility/domain thật.
- Dùng terminology nhất quán cho cùng một khái niệm.
- Đặt file ở vị trí hợp lý theo cấu trúc tự nhiên của project/ecosystem.
- Khi rename, kiểm tra import/reference/compatibility liên quan.

**Không được làm gì:**

- Không dùng tên mơ hồ như `misc`, `stuff`, `new`, `final2`, `temp` cho authored production source nếu không có nghĩa domain rõ.
- Không tạo nhiều tên khác nhau cho cùng một concept chỉ vì code nằm ở module khác.

**WARN / REVIEW khi:** tên hợp lệ nhưng khó đoán trách nhiệm, terminology bị lệch hoặc file đúng chức năng nhưng nằm ở vị trí khó tìm.

**FAIL khi:** naming làm người/tool chọn sai authority, sai implementation hoặc phá import/reference đang dùng.

**Ví dụ thực tế:** dùng `order_validation.py` thay vì `utils2.py`; dùng cùng thuật ngữ `customer_id` thay vì chỗ khác lại gọi `client_key` nếu chúng là cùng một concept.

---

## QT003 — SMALL_FOCUSED_UNITS

**Mục tiêu:** file/module/function đủ gọn và tập trung để dễ đọc, dễ sửa, dễ test; hạn chế god-file và trách nhiệm chồng chéo.

**Khi code cần làm gì:**

- Mỗi file/module nên có một trách nhiệm chính mô tả được bằng một câu ngắn.
- Function/method nên xử lý một workflow hoặc một bước logic rõ.
- Khi file lớn làm khó đọc/test/change isolation, tách theo responsibility thực.
- Chỉ tách khi boundary mới giúp code dễ hiểu hơn.

**Không được làm gì:**

- Không chia file máy móc chỉ để giảm số dòng.
- Không biến một file thành nơi chứa nhiều workflow không liên quan.
- Không coi line-count là thước đo chất lượng tuyệt đối.

**WARN / REVIEW khi:** authored text file vượt heuristic mặc định `>500` dòng hoặc `>64 KiB`, hoặc có dấu hiệu nhiều responsibility. Đây chỉ là tín hiệu review, không phải hard gate.

**FAIL khi:** unit gom nhiều responsibility đến mức sửa một phần thường xuyên phá phần không liên quan hoặc làm correctness/change isolation bị hỏng rõ ràng.

**Ví dụ thực tế:** `App.tsx` 1.200 dòng chứa navigation + Wi-Fi + client limits + mutations nên xem xét tách theo feature; một generated schema 2.000 dòng không phải lý do tự động để refactor.

---

## QT004 — MODULAR_BOUNDARIES_AND_DEPENDENCY_DIRECTION

**Mục tiêu:** module có boundary rõ, cohesion cao, coupling thấp và dependency dễ hiểu.

**Khi code cần làm gì:**

- Mỗi module/subsystem có responsibility rõ.
- Dependency nên đi theo hướng ổn định và dễ giải thích.
- Business/domain responsibility có owner rõ; UI/adapter/runtime phụ thuộc vào owner đó.
- Shared abstraction chỉ tạo khi thực sự có trách nhiệm dùng chung.
- Interface giữa module đủ nhỏ để giảm blast radius nhưng không abstraction hóa vô ích.

**Không được làm gì:**

- Không tạo cycle hoặc hidden back-channel nếu có thể tránh.
- Không copy business logic sang UI/adapter chỉ để tiện.
- Không tạo `common`, `shared` hoặc helper layer vô hạn chứa mọi thứ.

**WARN / REVIEW khi:** dependency direction khó hiểu, coupling cao, boundary mờ hoặc thay một module thường phải đọc nhiều module khác mới biết impact.

**FAIL khi:** cycle/hidden dependency/duplicate ownership làm một thay đổi local bắt buộc kéo theo thay đổi dây chuyền hoặc tạo correctness risk material.

**Ví dụ thực tế:** `OrderService` sở hữu rule tính tổng; web UI và API adapter gọi service đó thay vì mỗi nơi tự tính một bản.

---

## QT005 — CHANGE_ISOLATION_AND_COMPATIBILITY

**Mục tiêu:** sửa một chức năng phải ảnh hưởng ít nhất có thể tới source hiện tại và không âm thầm phá consumer.

**Khi code cần làm gì:**

- Trước thay đổi material, xác định changed scope, affected boundary và consumer chính.
- Ưu tiên sửa local phía sau stable boundary.
- Contract đang có consumer phải được thay đổi có chủ đích.
- Breaking change cần migration/coordinated update tương xứng impact.
- Compatibility layer chỉ giữ khi còn consumer/value thực.

**Không được làm gì:**

- Không sửa rải rác nhiều nơi nếu có thể sửa sau một owner/boundary.
- Không âm thầm đổi protocol/schema/persisted format mà consumer không biết.
- Không giữ compatibility shim vô thời hạn nếu nó tạo duplicate logic.

**WARN / REVIEW khi:** một thay đổi nhỏ phải chạm quá nhiều file/module hoặc blast radius lớn hơn trách nhiệm thực của feature.

**FAIL khi:** thay đổi phá consumer, protocol, persisted data hoặc dependency contract đang dùng mà không có migration/coordinated update phù hợp.

**Ví dụ thực tế:** thêm provider mới qua interface/provider registry thay vì sửa logic provider trong từng màn hình, từng API handler và từng job.

---

## QT006 — CLEAN_SOURCE_AND_NO_DUPLICATION

**Mục tiêu:** authored SOURCE sạch, current implementation rõ và không có nhiều implementation cạnh tranh cùng một trách nhiệm.

**Khi code cần làm gì:**

- Giữ authored SOURCE chỉ chứa material cần cho source/product.
- Retire dead/stale implementation khi replacement đã chắc chắn.
- Business/protocol logic có một owner chính.
- Phân biệt generated output với authored source.
- Xem semantic duplication quan trọng hơn lexical similarity.

**Không được làm gì:**

- Không để build cache, temp, bytecode, local-machine residue hoặc secret trong authored SOURCE.
- Không để `old`, `new`, `v2` implementation cùng active mà không rõ owner.
- Không copy-paste cùng business/protocol logic thành nhiều bản độc lập.

**WARN / REVIEW khi:** có duplication nhỏ, temporary debt hoặc stale code chưa gây ambiguity nhưng nên retire; hoặc SOURCE chứa dependency/generated/runtime-like directory hay local environment file mà checker chưa thể biết đó là authored truth, intentional vendoring hay local residue.

**FAIL khi:** residue/secret/stale implementation/duplicate active logic có thể làm build, runtime hoặc maintainer chọn sai truth.

**Ví dụ thực tế:** sau khi `payment_service.py` thay thế hoàn toàn `payment_service_old.py`, archive/retire bản cũ thay vì để cả hai active trong SOURCE.

---

## QT007 — RISK_PROPORTIONAL_TESTING

**Mục tiêu:** test đúng phần thay đổi và đúng risk, không biến mọi commit thành full-regression ceremony.

**Khi code cần làm gì:**

- Behavior thay đổi phải có verification phù hợp.
- Thay đổi local ưu tiên targeted test cho unit/boundary liên quan.
- Bug fix thêm regression test khi test đó có giá trị lâu dài.
- Full regression dùng khi impact rộng, shared boundary thay đổi, release hoặc risk profile cần.

**Không được làm gì:**

- Không bỏ test material chỉ để nhanh.
- Không bắt chạy toàn bộ test suite cho mọi thay đổi nhỏ nếu không có impact tương ứng.
- Không tạo test/evidence chỉ để tăng số lượng.

**WARN / REVIEW khi:** coverage chưa tối ưu nhưng chưa có material risk chưa được kiểm; hoặc impact thực cần judgment.

**FAIL khi:** behavior/risk material đã thay đổi nhưng không có verification đủ để phát hiện regression tương ứng.

**Ví dụ thực tế:** sửa parser của một file format thì chạy parser tests + regression case; đổi shared schema được hàng chục module dùng thì mở rộng regression tương ứng.

---

## QT008 — SAFE_MUTATION_AND_DATA_PROTECTION

**Mục tiêu:** thao tác có thể mất dữ liệu, corrupt state hoặc tạo side effect khó hoàn nguyên phải được bảo vệ mạnh hơn code edit thông thường.

**Khi code cần làm gì:**

- Với mutation high-risk, dùng precondition và recovery/rollback phù hợp.
- Sau external mutation, reconcile current state trước khi tiếp tục dựa vào state cũ.
- Data migration phải bảo vệ compatibility/recovery theo risk.
- Secret/credential chỉ xuất hiện ở nơi cần thiết và không rò vào source/log/evidence.

**Không được làm gì:**

- Không áp cùng ceremony high-risk cho low-risk local edit.
- Không retry destructive/non-idempotent action mù quáng.
- Không tiếp tục dựa trên stale state sau mutation bên ngoài.

**WARN / REVIEW khi:** mức risk phụ thuộc domain/architecture hoặc chưa rõ operation có destructive/stateful hay không.

**FAIL khi:** high-risk operation có thể mất dữ liệu, duplicate side effect hoặc phá integrity mà không có guard/recovery tương xứng.

**Ví dụ thực tế:** migration database cần precondition + backup/rollback/reconcile; đổi label UI không cần receipt chain hay recovery workflow.

---

## QT009 — SPECIALIZED_CONTROLS_ARE_PROFILE_DRIVEN

**Mục tiêu:** project chỉ gánh rule chuyên biệt đúng với capability/risk thật của nó.

**Khi code cần làm gì:**

- Luôn dùng QT001–QT010 làm baseline.
- Chỉ bật specialized profile khi capability/risk tương ứng tồn tại hoặc Owner/project chủ động bật.
- Profile phải nhỏ, dễ đọc, có consumer cụ thể và có thể retire khi capability không còn.
- Có thể dùng profile như `SECURITY_PRIVACY`, `PERSISTENT_DATA`, `WEB_API`, `DEPLOYMENT_OPERATIONS`, `AI_PROVIDER`, `COMPLIANCE` khi applicable.

**Không được làm gì:**

- Không biến rule chuyên biệt của một project thành universal rule cho project khác.
- Không block project vì một capability mà project không có.
- Không tự kết luận PASS chỉ vì không thấy profile; applicability có thể cần context.

**WARN / REVIEW khi:** chưa đủ context để biết capability/risk nào applicable hoặc profile hiện tại có đang dư/thừa thiếu hay không.

**FAIL khi:** control không applicable vẫn block development, hoặc một material capability/risk đã biết nhưng required control của project bị bỏ qua.

**Ví dụ thực tế:** project CLI không có database không phải tuân migration rules; project giữ persistent customer data thì có thể bật `PERSISTENT_DATA`.

---

## QT010 — GOVERNANCE_SIMPLICITY_AND_COST_CONTROL

**Mục tiêu:** governance phải giúp code sạch và phát triển nhanh hơn, không trở thành một project thứ hai kìm hãm sản phẩm.

**Khi code cần làm gì:**

- Rule/checker/contract/document/evidence mới phải có problem statement, consumer và giá trị giảm risk rõ.
- Dùng checker deterministic cho thứ máy có thể biết; việc cần judgment trả REVIEW/guidance.
- Với thay đổi nhỏ, dùng history/VCS/test output sẵn có nếu đã đủ.
- Định kỳ bỏ bớt ceremony/machinery khi chi phí duy trì lớn hơn giá trị.

**Không được làm gì:**

- Không dùng số lượng rule/test/file/hash/manifest/score làm proxy cho chất lượng.
- Không tạo machine contract chỉ để mirror prose nếu không có consumer.
- Không để validator tự sửa source chỉ để ép PASS.
- Không bắt developer refactor ngoài changed/affected scope chỉ để checker xanh.

**WARN / REVIEW khi:** ceremony tăng, nhiều bước không rõ consumer, hoặc governance bắt đầu tốn công đáng kể nhưng chưa block development.

**FAIL khi:** governance buộc project duy trì machinery không phục vụ risk/consumer thực, tạo duplicate authority hoặc trực tiếp cản trở development một cách material.

**Ví dụ thực tế:** sửa typo không cần receipt + manifest + full regression; thay public schema nhiều consumer có thể cần release checks mạnh hơn.

---

# 4. Optional profile model

Optional profile không phải phần mở rộng tự động của rule count.

Một project có thể bật profile để thêm acceptance/checks chuyên biệt, nhưng các check đó phải trace tới:

- capability/risk thực;
- Owner/project decision;
- consumer cụ thể;
- cách tắt/retire khi capability không còn.

Profile không được renumber core. Core luôn là `QT001–QT010`.

Các profile có thể chứa checklist/check IDs riêng nhưng không tạo `QT011+` universal rules.

## Profile: VERSIONED_PROJECT_HISTORY

Profile này quản lý version lifecycle, versioned artifact paths và source recovery cho project cần lịch sử/recovery có cấu trúc rõ.

Canonical profile document:

`profiles/VERSIONED_PROJECT_HISTORY.md`

Profile controls:

- `VPH001 — VERSION_LIFECYCLE`
- `VPH002 — VERSIONED_ARTIFACT_PATHS`
- `VPH003 — VERSIONED_SOURCE_RECOVERY`

Profile này không tạo `QT011+` và không tự động áp dụng cho mọi adopter.

# 5. Machine verifier contract cho v3

Canonical verifier phải ưu tiên output ngắn và actionable:

- Rule ID.
- Status: `PASS`, `WARN`, `FAIL`, hoặc `REVIEW`.
- Một lý do ngắn.
- File/path/symbol liên quan khi có.
- Suggested next action nếu status khác `PASS`.
- Scan mode: `FULL` hoặc `SCOPED`, kèm evaluated scope khi có.

Không bắt buộc:

- compliance score;
- receipt chain cho mỗi run;
- evidence manifest cho mọi check;
- full project reconstruction;
- 1 rule = 1 checker file;
- overall FAIL chỉ vì một check cần human review.

Checker không được tự tạo rule mới.

Khi chạy `SCOPED`, checker phải fail-closed nếu path thoát khỏi canonical SOURCE và không được dùng PASS scoped để tuyên bố toàn project sạch.

# 6. v2 → v3 disposition

Bảng này bảo tồn ý định của v2 nhưng không giữ 56 rule active.

| v2 rule | v3 disposition |
|---|---|
| QT001 PHYSICAL_PROJECT_TRUTH | MERGE → QT001 |
| QT002 PROJECT_IDENTITY_BOUNDARY | MERGE → QT001 |
| QT003 SINGLE_AUTHORITY | MERGE → QT001 |
| QT004 PROJECT_TYPE_AND_PROFILE | MERGE → QT009 |
| QT005 SEVEN_ROOT_WORKSPACE | RETIRE as universal mandate; project-local layout only |
| QT006 CLEAN_SOURCE | MERGE → QT003 + QT006 |
| QT007 STANDARD_NAMING | MERGE → QT002 |
| QT008 VERSION_SINGLE_AUTHORITY | MERGE → QT001 |
| QT009 MODULAR_ARCHITECTURE | MERGE → QT004 + QT005 |
| QT010 UUID_V7 | OPTIONAL profile/tooling convention |
| QT011 ENGLISH_SOURCE | OPTIONAL project/toolchain convention |
| QT012 MULTILINGUAL_UI | OPTIONAL UI/i18n profile |
| QT013 PROJECT_DOCUMENTATION_AUTHORITIES | MERGE minimal intent → QT001 + QT010 |
| QT014 HUMAN_MACHINE_DUAL_DOCUMENTATION | RETIRE as universal mandate |
| QT015 SELF_CONTAINED_PROJECT_KNOWLEDGE | MERGE minimal intent → QT001 + QT010 |
| QT016 CROSS_SESSION_CONTINUITY | MERGE minimal current-truth intent → QT001; advanced continuity optional |
| QT017 MODEL_NEUTRAL_CONTINUITY | RETIRE as universal mandate; optional tooling concern |
| QT018 ACCOUNT_INDEPENDENT_HANDOFF | RETIRE as universal mandate; optional collaboration concern |
| QT019 DETERMINISTIC_PROJECT_RECONSTRUCTION | OPTIONAL release/critical-system profile |
| QT020 DIRECT_SOURCE_CODING | RETIRE as universal workflow rule |
| QT021 UNIVERSAL_ACTIVITY_LOGGING | OPTIONAL audit/high-risk profile |
| QT022 EXTERNAL_MUTATION_RECONCILIATION | MERGE → QT008 |
| QT023 DOWNLOAD_AND_INPUT_TRUST | OPTIONAL security/supply-chain profile |
| QT024 GOVERNANCE_ADOPTION_AND_PINNING | OPTIONAL governance-distribution profile |
| QT025 VALIDATOR_TRUTH_ONLY | MERGE → QT010 |
| QT026 MEASURABLE_QUALITY | MERGE → QT003 + QT006 + QT007; no universal score |
| QT027 PASS_FAIL_BLOCKED_TRUTH | REPLACE with v3 PASS/WARN/FAIL/REVIEW model → QT010 |
| QT028 CANONICAL_PROMOTION | OPTIONAL release profile |
| QT029 DATA_AND_ACTION_INTEGRITY | MERGE core safety intent → QT008 |
| QT030 OBSERVABILITY_AND_SUPPORTABILITY | OPTIONAL operations profile |
| QT031 SECURITY_AND_PRIVACY | OPTIONAL SECURITY_PRIVACY profile |
| QT032 INTELLECTUAL_PROPERTY | OPTIONAL COMMERCIAL_ARTIFACT profile |
| QT033 RESOURCE_EFFICIENCY | OPTIONAL performance profile |
| QT034 SCALABILITY_AND_CAPACITY | OPTIONAL HIGH_SCALE_RELIABILITY profile |
| QT035 RESILIENCE_AND_RECOVERY | OPTIONAL reliability/data profile |
| QT036 CROSS_PLATFORM | OPTIONAL CROSS_PLATFORM profile |
| QT037 ENGINEERING_AUTOMATION_COMPATIBILITY | OPTIONAL tooling/CI profile |
| QT038 WAIVER_CONTROL | RETIRE formal universal waiver machinery; exception handling stays project-local |
| QT039 APPLICATION_AND_DATA_LOCATION | OPTIONAL platform/data profile |
| QT040 PRODUCT_UX_UI_AND_ACCESSIBILITY | OPTIONAL UI/accessibility profile |
| QT041 INSTALL_UPDATE_UNINSTALL_LIFECYCLE | OPTIONAL DESKTOP_MOBILE profile |
| QT042 TESTING_AND_VERIFICATION_STRATEGY | MERGE → QT007 |
| QT043 DEPENDENCY_AND_SUPPLY_CHAIN_INTEGRITY | OPTIONAL SECURITY_PRIVACY / supply-chain profile |
| QT044 API_PROTOCOL_COMPATIBILITY | MERGE base compatibility → QT005; advanced checks optional WEB_API profile |
| QT045 PERSISTENT_DATA_LIFECYCLE | MERGE base safety → QT008; advanced checks optional PERSISTENT_DATA profile |
| QT046 AI_MODEL_AND_PROVIDER_GOVERNANCE | OPTIONAL AI_PROVIDER profile |
| QT047 CLIENT_RUNTIME_AND_DISTRIBUTION_COMPATIBILITY | OPTIONAL distribution/platform profile |
| QT048 AUTHENTICATION_AUTHORIZATION_AND_ENTITLEMENT | OPTIONAL SECURITY_PRIVACY / COMMERCIAL_ARTIFACT profile |
| QT049 CANONICAL_EXECUTION_RUNNER | RETIRE as universal mandate; optional automation/runtime implementation |
| QT050 RELEASE_ARTIFACT_PROVENANCE_AND_REPRODUCIBILITY | OPTIONAL release profile |
| QT051 CONFIGURATION_AND_ENVIRONMENT_MANAGEMENT | OPTIONAL operations profile |
| QT052 DEPLOYMENT_ROLLOUT_AND_ROLLBACK | OPTIONAL DEPLOYMENT_OPERATIONS profile |
| QT053 APPLICABLE_COMMERCIAL_AND_REGULATORY_COMPLIANCE | OPTIONAL COMPLIANCE profile |
| QT054 ARCHITECTURE_AND_DECISION_GOVERNANCE | MERGE architecture intent → QT004 + QT005; formal ADR lifecycle optional |
| QT055 PROGRAMMING_LANGUAGE_AND_TOOLCHAIN_STRATEGY | OPTIONAL technology profile; Rust may remain preferred without universal blocking |
| QT056 COMMERCIAL_ARTIFACT_EXPOSURE_AND_TAMPER_RESISTANCE | OPTIONAL COMMERCIAL_ARTIFACT / SECURITY profile |

# 7. Public adoption principle

Một adopter không cần copy governance factory nội bộ.

Public package v3 nên chỉ chứa material cần để:

1. đọc `QT001–QT010`;
2. biết profile nào applicable;
3. chạy verifier nhẹ;
4. hiểu và sửa kết quả.

History, collaboration engine, internal receipts, self-hosting closure machinery và rejected-version evidence không phải adopter payload mặc định.

# 8. Change rule for governance itself

Thêm hoặc tăng độ nặng một core rule cần chứng minh:

1. defect/risk cụ thể đã xảy ra hoặc có xác suất/impact đủ material;
2. existing core/profile không xử lý được;
3. proposed rule là cách đơn giản nhất để giảm risk;
4. expected maintenance cost chấp nhận được.

Nếu không thỏa, dùng guidance hoặc optional profile thay vì tạo universal mandatory rule.

# 9. Final principle

Core governance phải giúp trả lời nhanh:

- Truth ở đâu?
- File này chịu trách nhiệm gì?
- Thay đổi này ảnh hưởng tới đâu?
- Test nào cần chạy?
- Có risk nào cần control mạnh hơn không?

Nếu governance làm các câu hỏi này khó hơn, governance cần được sửa.
