window.__ModuleLoader__.load({
	id: "dsh-workbuddy-bridge",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		let react_dom = require("react-dom");
		//#region src/client/format.ts
		/** Display formatting shared by the card's panels. */
		/**
		* Compact token count: the catalog's own round numbers (`200000`, `1000000`)
		* read better as `200K` / `1M`, and no precision is lost because these values
		* are always whole thousands.
		*/
		function formatTokens(tokens) {
			if (tokens >= 1e6 && tokens % 1e6 === 0) return `${tokens / 1e6}M`;
			if (tokens >= 1e3 && tokens % 1e3 === 0) return `${tokens / 1e3}K`;
			return String(tokens);
		}
		/** Locale-formatted count. */
		function formatNumber(value) {
			return new Intl.NumberFormat(void 0).format(value);
		}
		/** Locale-formatted date and time from epoch milliseconds. */
		function formatTime(ms) {
			return new Intl.DateTimeFormat(void 0, {
				dateStyle: "medium",
				timeStyle: "short"
			}).format(new Date(ms));
		}
		/**
		* Locale-formatted cycle-reset time, falling back to the wire string.
		*
		* The host forwards the upstream's own timestamp; when it is not a date this
		* plugin can parse, the raw text is still more useful than nothing.
		*/
		function formatCycleReset(time) {
			const parsed = Date.parse(time);
			return Number.isNaN(parsed) ? time : formatTime(parsed);
		}
		/** Locale-formatted percentage, at most one fraction digit. */
		function formatPercent(percent) {
			return new Intl.NumberFormat(void 0, { maximumFractionDigits: 1 }).format(percent);
		}
		//#endregion
		//#region \0workbuddy-css:D:\ProjectSomething\dsh-plugins\dsh-workbuddy-bridge\src\client\workbuddy.module.css.js
		const css$1 = "._1kHyqG_page,._1kHyqG_cards{flex-direction:column;gap:12px;display:flex}._1kHyqG_toggleRow{border-top:.5px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary);justify-content:space-between;align-items:flex-start;gap:16px;padding:12px 0;font-size:13px;line-height:1.5;display:flex}._1kHyqG_toggleLabel{flex-direction:column;flex:1;gap:2px;min-width:0;display:flex}._1kHyqG_toggleHint{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:1.5}._1kHyqG_body{flex-direction:column;padding:4px 0 12px;display:flex}._1kHyqG_section{flex-direction:column;gap:6px;margin:12px 0;display:flex}._1kHyqG_title{color:var(--dsw-alias-label-primary);margin:0;font-size:13px;font-weight:500;line-height:1.5}._1kHyqG_row{flex-wrap:wrap;justify-content:space-between;align-items:center;gap:8px;padding:12px 0;display:flex}._1kHyqG_summaryRow{flex-wrap:wrap;gap:4px;height:auto;min-height:28px}._1kHyqG_summaryTitle{flex:1;min-width:0}._1kHyqG_statusLine{color:var(--dsw-alias-label-tertiary);align-items:center;gap:6px;font-size:12px;line-height:1.5;display:inline-flex}._1kHyqG_text{color:var(--dsw-alias-label-secondary);margin:0;font-size:13px;line-height:1.5}._1kHyqG_dim{color:var(--dsw-alias-label-tertiary);margin:0;font-size:12px;line-height:1.5}._1kHyqG_error{color:var(--dsw-alias-state-error-primary);margin:0;font-size:12px;line-height:1.5}._1kHyqG_package{flex-direction:column;gap:8px;display:flex}._1kHyqG_packageLabel{color:var(--dsw-alias-label-secondary);justify-content:space-between;gap:8px;font-size:13px;line-height:1.5;display:flex}._1kHyqG_track{corner-shape:round;background:var(--dsw-alias-border-l3);border-radius:999px;height:8px;overflow:hidden}._1kHyqG_fill{border-radius:inherit;background:var(--dsw-alias-brand-primary);height:100%}._1kHyqG_list{border:.5px solid var(--dsw-alias-border-l1);border-radius:10px;gap:6px;min-width:0;max-height:280px;margin:0;padding:14px;display:grid;overflow:auto}._1kHyqG_modelRow{justify-content:space-between;align-items:flex-start;gap:8px;display:flex}._1kHyqG_modelMain{align-items:center;gap:8px;min-width:0;display:flex}._1kHyqG_modelStack{flex-direction:column;gap:2px;min-width:0;display:flex}._1kHyqG_name{color:var(--dsw-alias-label-primary);font-size:13px;line-height:1.5}._1kHyqG_modelEnd{text-align:right;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums;flex-direction:column;gap:2px;font-size:12px;line-height:1.5;display:flex}._1kHyqG_meta{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:1.5}._1kHyqG_badges{flex-wrap:wrap;align-items:center;gap:6px;display:flex}._1kHyqG_sectionActions{justify-content:flex-end;display:flex}._1kHyqG_probeRow{justify-content:space-between;align-items:center;gap:8px;display:flex}._1kHyqG_probeEnd{flex:none;align-items:center;gap:8px;display:inline-flex}._1kHyqG_assist{border:.5px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-module-platform);flex-direction:column;gap:8px;padding:12px;display:flex}._1kHyqG_prompt{min-width:0;color:var(--dsw-alias-label-secondary);white-space:pre-wrap;overflow-wrap:anywhere;user-select:text;flex:220px;margin:0;font-size:12px;line-height:1.6}._1kHyqG_promptRow{border:.5px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-sm);background:var(--dsw-alias-bg-layer-3);flex-wrap:wrap;align-items:flex-start;gap:8px;padding:8px 9px 8px 11px;display:flex}";
		const tagId$1 = "dsh-workbuddy-bridge/workbuddy.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$1) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-workbuddy-bridge";
			tag.dataset.pluginCss = tagId$1;
			tag.textContent = css$1;
			document.head.appendChild(tag);
		}
		var workbuddy_module_css_default = {
			"assist": "_1kHyqG_assist",
			"badges": "_1kHyqG_badges",
			"body": "_1kHyqG_body",
			"cards": "_1kHyqG_cards",
			"dim": "_1kHyqG_dim",
			"error": "_1kHyqG_error",
			"fill": "_1kHyqG_fill",
			"list": "_1kHyqG_list",
			"meta": "_1kHyqG_meta",
			"modelEnd": "_1kHyqG_modelEnd",
			"modelMain": "_1kHyqG_modelMain",
			"modelRow": "_1kHyqG_modelRow",
			"modelStack": "_1kHyqG_modelStack",
			"name": "_1kHyqG_name",
			"package": "_1kHyqG_package",
			"packageLabel": "_1kHyqG_packageLabel",
			"page": "_1kHyqG_page",
			"probeEnd": "_1kHyqG_probeEnd",
			"probeRow": "_1kHyqG_probeRow",
			"prompt": "_1kHyqG_prompt",
			"promptRow": "_1kHyqG_promptRow",
			"row": "_1kHyqG_row",
			"section": "_1kHyqG_section",
			"sectionActions": "_1kHyqG_sectionActions",
			"statusLine": "_1kHyqG_statusLine",
			"summaryRow": "_1kHyqG_summaryRow",
			"summaryTitle": "_1kHyqG_summaryTitle",
			"text": "_1kHyqG_text",
			"title": "_1kHyqG_title",
			"toggleHint": "_1kHyqG_toggleHint",
			"toggleLabel": "_1kHyqG_toggleLabel",
			"toggleRow": "_1kHyqG_toggleRow",
			"track": "_1kHyqG_track"
		};
		//#endregion
		//#region src/client/panels.tsx
		/**
		* The card's three panels and the Agent assist block.
		*
		* Every control here is an official primitive (`Tag`, `Checkbox`, `Button`,
		* `Pill`), so the panels inherit the host theme and keyboard behaviour without
		* this plugin shipping a single hand-built widget.
		*/
		/**
		* The reason codes whose failures the Agent assist block covers: the plugin
		* cannot reach a decryption program, for any of the five reasons the host
		* reports.
		*
		* This is the *only* place the card decides whether the block applies. It
		* branches on the code, never on `reason` text: the prose is written for a
		* human and is expected to change, so matching it would silently stop matching
		* after any wording edit.
		*
		* `encrypted-credential-unreadable` is deliberately absent — the app was found
		* and ran, so "look for the app" is not the fix for it.
		*/
		const ASSIST_REASON_CODES = [
			"electron-binary-not-found",
			"electron-binary-ambiguous",
			"electron-binary-unavailable",
			"electron-path-invalid",
			"electron-discovery-incomplete"
		];
		/** Whether a reason code is one the assist block covers. */
		function assistCodeFor(reasonCode) {
			return reasonCode !== void 0 && ASSIST_REASON_CODES.includes(reasonCode) ? reasonCode : void 0;
		}
		/** Locale key for one failure's summary inside the Agent prompt. */
		function assistSummaryKey(code, variant) {
			switch (code) {
				case "electron-binary-not-found": return "assistNotFound";
				case "electron-binary-ambiguous": return "assistAmbiguous";
				case "electron-discovery-incomplete": return "assistIncomplete";
				case "electron-path-invalid": return "assistPathInvalid";
				default: return variant.unavailableKey;
			}
		}
		/**
		* Localize an upstream promotional badge label, with an unknown-badge fallback.
		*
		* The CN catalog spells badges in Chinese (`限时免费`, `夜间折扣`); the
		* international document carries English (`Free now`). Both are mapped so the
		* same promotion reads consistently in either UI language, and anything else
		* passes through verbatim — an unrecognized badge is still information the
		* upstream chose to show.
		*/
		function badgeLabel(badge, t) {
			if (badge === "限时免费") return t("badgeLimitedFree");
			if (badge === "夜间折扣") return t("badgeNightDiscount");
			if (badge === "Free now") return t("badgeFreeNow");
			return badge;
		}
		/** One model's promotional badges, plus `Free` when the upstream says so. */
		function ModelBadges({ model, t }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
				className: workbuddy_module_css_default.badges,
				children: [model.badges?.map((badge) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tag, {
					tone: "success",
					children: badgeLabel(badge, t)
				}, badge)), model.free === true ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tag, {
					tone: "success",
					children: t("freeModel")
				}) : null]
			});
		}
		/**
		* One billing package as a labelled progress bar.
		*
		* A package whose allowance the upstream never reported (`size` not positive)
		* has no percentage to state. It must not fall back to 100%: the plugin would
		* be claiming a full quota it knows nothing about, which is the opposite of the
		* honest "remaining N" line printed below it. Unknown size therefore renders the
		* percent slot as unknown copy and an unfilled, indeterminate track.
		*/
		function CreditBar({ label, remain, size, unlimited, t }) {
			const quota = t("unlimitedQuota");
			if (unlimited === true) return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: workbuddy_module_css_default.package,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: workbuddy_module_css_default.packageLabel,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: label }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: quota })]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: workbuddy_module_css_default.track,
					role: "progressbar",
					"aria-label": label,
					"aria-valuetext": quota
				})]
			});
			const sizeKnown = size > 0;
			const detail = sizeKnown ? t("exactRemaining", {
				remain: formatNumber(remain),
				size: formatNumber(size)
			}) : t("creditPackageUnknownSize", { remain: formatNumber(remain) });
			const percent = sizeKnown ? remain / size * 100 : void 0;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: workbuddy_module_css_default.package,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: workbuddy_module_css_default.packageLabel,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: label }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: percent === void 0 ? t("percentUnknown") : t("percentRemaining", { percent: formatPercent(percent) }) })]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: workbuddy_module_css_default.track,
						role: "progressbar",
						"aria-label": label,
						...percent === void 0 ? { "aria-valuetext": detail } : {
							"aria-valuemin": 0,
							"aria-valuemax": 100,
							"aria-valuenow": percent
						},
						children: percent === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: workbuddy_module_css_default.fill,
							style: { width: `${Math.max(0, Math.min(100, percent))}%` }
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: workbuddy_module_css_default.meta,
						children: detail
					})
				]
			});
		}
		/** The per-package credit breakdown, under the card's own "Credits" tab. */
		function CreditsPanel({ credits, t }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: workbuddy_module_css_default.section,
				children: credits.accounts.filter((account) => account.packageName === "enterprise" || account.remain > 0 || account.unlimited === true).map((account, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CreditBar, {
					label: account.packageName === "enterprise" ? t("packageEnterprise") : account.packageName,
					remain: account.remain,
					size: account.size,
					unlimited: account.unlimited,
					t
				}, `${account.packageName}-${String(index)}`))
			});
		}
		/**
		* The model catalog: one row per model, visibility checkbox on the left,
		* context window, rate and badges on the right.
		*
		* The list is driven by the full current catalog, not by context metadata:
		* hiding a model is a statement about the picker, and a model without a
		* declared window is still hideable — its row just shows an em dash where the
		* capacity would be. Rows with a window keep the original ordering (largest
		* first); rows without one trail at the end in catalog order.
		*
		* Purely a report of the upstream's own numbers. The plugin offers no tier
		* picker: the CN catalog declares one capacity per model and publishes no
		* alternatives, so a menu there would mean inventing client-side policy. The
		* international document does declare alternatives, and they are shown as a
		* secondary figure rather than merged into one number — the default is the
		* budget actually requested, while the larger value is a ceiling the upstream
		* would accept.
		*/
		function ModelsPanel({ models, visibility, toggling, disabled, onToggle, t }) {
			const rows = [...models ?? []].sort((a, b) => {
				if (a.contextWindow === void 0) return b.contextWindow === void 0 ? 0 : 1;
				if (b.contextWindow === void 0) return -1;
				return b.contextWindow - a.contextWindow;
			});
			if (rows.length === 0) return null;
			const hidden = new Set(visibility?.hidden ?? []);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: workbuddy_module_css_default.section,
				children: [visibility === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: workbuddy_module_css_default.text,
					children: t("visibilityIntro")
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: workbuddy_module_css_default.list,
					children: rows.map((model) => {
						const capacity = model.contextWindow;
						const alternative = capacity !== void 0 && model.maxContextWindow !== void 0 && model.maxContextWindow > capacity ? model.maxContextWindow : void 0;
						return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: workbuddy_module_css_default.modelRow,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: workbuddy_module_css_default.modelMain,
								children: visibility === void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: workbuddy_module_css_default.name,
									children: model.name
								}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Checkbox, {
									checked: !hidden.has(model.id),
									disabled: disabled || toggling.has(model.id),
									label: model.name,
									onChange: (visible) => {
										onToggle(model.id, visible, visibility.account);
									}
								})
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: workbuddy_module_css_default.modelEnd,
								children: [
									model.credits === void 0 ? model.rateUnknown === true ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: workbuddy_module_css_default.dim,
										children: t("rateUnknown")
									}) : null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: workbuddy_module_css_default.dim,
										children: t("rate", { rate: model.credits })
									}),
									capacity === void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: workbuddy_module_css_default.meta,
										"aria-label": t("contextUnknown"),
										children: "—"
									}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: formatTokens(capacity) }),
									alternative !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: workbuddy_module_css_default.dim,
										children: t("contextUpTo", { size: formatTokens(alternative) })
									}) : capacity !== void 0 && model.defaultContextWindow !== void 0 && model.defaultContextWindow < capacity ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: workbuddy_module_css_default.dim,
										children: t("contextDefault", { size: formatTokens(model.defaultContextWindow) })
									}) : null,
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: workbuddy_module_css_default.badges,
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ModelBadges, {
											model,
											t
										})
									})
								]
							})]
						}, model.id);
					})
				})]
			});
		}
		/**
		* Reasoning-effort detection: one row per detectable model.
		*
		* Two deliberate UX rules:
		* - **one press detects.** The row states what the model accepts and the button
		*   beside it runs the check; the cost is stated once, above the list, instead
		*   of being asked again per row. A confirmation whose only other option is
		*   "cancel" costs a click and answers nothing;
		* - a `non-validating` result is presented as an observation about the
		*   parameter ("this model does not check it"), never as a statement that a
		*   level is unsupported.
		*
		* The tab bar owns the heading, so this panel renders no heading of its own.
		*/
		function ProbePanel({ probe, models, busy, onDetect, onClear, t }) {
			const [runningModel, setRunningModel] = (0, react.useState)();
			const armed = (0, react.useRef)(false);
			(0, react.useEffect)(() => {
				if (runningModel === void 0) return;
				if (busy || probe.running) {
					armed.current = true;
					return;
				}
				if (!armed.current) return;
				armed.current = false;
				setRunningModel(void 0);
			}, [
				runningModel,
				busy,
				probe.running
			]);
			if (probe.candidates.length === 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: workbuddy_module_css_default.text,
				children: t("probeResultEmpty")
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: workbuddy_module_css_default.section,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: workbuddy_module_css_default.text,
						children: t("probeCostNote")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: workbuddy_module_css_default.list,
						children: probe.candidates.map((id) => {
							const result = probe.results.find((entry) => entry.id === id);
							const name = models?.find((model) => model.id === id)?.name ?? result?.name ?? id;
							return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: workbuddy_module_css_default.modelStack,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: workbuddy_module_css_default.probeRow,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: workbuddy_module_css_default.name,
										children: name
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: workbuddy_module_css_default.probeEnd,
										children: [result === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tag, {
											tone: result.validation === "validating" ? "success" : "neutral",
											children: result.validation === "validating" && result.efforts.length > 0 ? result.efforts.join(" / ") : t(result.validation === "non-validating" ? "probeResultNotValidating" : "probeResultUnknown")
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
											size: "sm",
											disabled: probe.running || busy,
											onClick: () => {
												setRunningModel(id);
												onDetect(id);
											},
											children: runningModel === id ? t("probeRunning", { model: name }) : t(result === void 0 ? "probeStart" : "probeRedetect")
										})]
									})]
								}), result === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: workbuddy_module_css_default.meta,
									children: t("probeResultAt", { time: formatTime(result.probedAt) })
								})]
							}, id);
						})
					}),
					probe.results.length === 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: workbuddy_module_css_default.sectionActions,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							size: "sm",
							disabled: busy,
							onClick: onClear,
							children: t("probeClear")
						})
					})
				]
			});
		}
		/**
		* The Agent assist block for a path failure: what is wrong, one copyable
		* request, and a re-check. Rendered only for the codes the host can do
		* something about.
		*/
		function AssistBlock({ variant, code, busy, onRecheck, t }) {
			const [copied, setCopied] = (0, react.useState)(false);
			const [copyFailed, setCopyFailed] = (0, react.useState)(false);
			const prompt = t("assistantPrompt", {
				appName: variant.appName,
				failureSummary: t(assistSummaryKey(code, variant))
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: workbuddy_module_css_default.assist,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h4", {
						className: workbuddy_module_css_default.title,
						children: t("assistantHeading")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: workbuddy_module_css_default.text,
						children: t("assistantIntro")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: workbuddy_module_css_default.promptRow,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: workbuddy_module_css_default.prompt,
							children: prompt
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							size: "sm",
							onClick: () => {
								(0, _deepseek_ai_dsh_client_ui_primitives.writeClipboard)(prompt).then((ok) => {
									setCopied(ok);
									setCopyFailed(!ok);
								});
							},
							children: t("assistantCopy")
						})]
					}),
					copied ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: workbuddy_module_css_default.dim,
						role: "status",
						children: t("assistantCopied")
					}) : null,
					copyFailed ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: workbuddy_module_css_default.dim,
						role: "status",
						children: t("assistantCopyFailed")
					}) : null,
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: workbuddy_module_css_default.text,
						children: t("assistantAfter")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						size: "sm",
						disabled: busy,
						onClick: onRecheck,
						children: busy ? t("assistantRechecking") : t("assistantRecheck")
					})
				]
			});
		}
		//#endregion
		//#region src/client/status-document.ts
		/**
		* Whether a parsed status response really is a status document.
		*
		* A 200 is not a promise about the body: it may be empty, literal `null`, a
		* non-JSON page from a proxy, or an array. Both halves of the browser plugin
		* read the same route, so both must agree on what is valid — storing an
		* unreadable value puts something in state that the next render dereferences.
		*
		* The check is deliberately limited to the discriminator (plus `error`'s
		* `message`, which the error paragraph renders): validating optional fields
		* here would reject documents the host legitimately omits fields from.
		*
		* `reasonCode` is therefore *not* rejected here — a card renders `reason`
		* either way — but every reader must narrow it with
		* `isWorkBuddySignedOutReasonCode` before branching on it, since the wire
		* value is not guaranteed to be inside the enum.
		*/
		function isWorkBuddyWebStatus(value) {
			if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
			const wrapped = value;
			const status = wrapped["status"];
			if (status === "signed-out" || status === "signed-in") return true;
			return status === "error" && typeof wrapped["message"] === "string";
		}
		//#endregion
		//#region src/client/use-status.ts
		/**
		* One variant's live status: the read, the poll, and every write.
		*
		* Three policies this hook exists to hold, each of which was a real defect
		* before it was named:
		*
		* 1. **A failed read never erases a document already on screen.** It is
		*    recorded beside that document instead. Blanking the card over one
		*    transient error loses the account, credits, and model list the reader was
		*    looking at, which is worse than the error.
		* 2. **The newest read wins.** A slow poll begun before a manual action must
		*    not settle after that action's own refresh and restore the older
		*    document, so every read is numbered when it *starts*.
		* 3. **The poll's liveness depends on the last successful read, not on what is
		*    rendered.** A failed read must not disarm the interval, or one blip
		*    leaves the card blank until the user clicks Refresh.
		*
		* Writes (refresh the catalog, detect reasoning levels, hide a model) share the
		* control route and the read-back: each one re-reads afterwards so the host's
		* truth is what stays on screen, and each reports its refusal beside the
		* document rather than in place of it.
		*/
		/** How often the status document is re-read while a variant is signed in. */
		const POLL_INTERVAL_MS = 6e4;
		/**
		* Own one variant's status document.
		* @param variant - which product's routes and copy to use.
		* @param t - the dictionary reader, for the two messages this hook composes itself.
		*/
		function useWorkBuddyStatus(variant, t) {
			const [status, setStatus] = (0, react.useState)();
			const [readFailure, setReadFailure] = (0, react.useState)();
			const [busy, setBusy] = (0, react.useState)(false);
			const [toggling, setToggling] = (0, react.useState)(() => /* @__PURE__ */ new Set());
			/**
			* Whether the last read that *stated* the session found none — a genuine
			* signed-out answer, as opposed to a read that failed. Kept apart from
			* `status` on purpose: a failed read leaves it untouched, so a transient
			* failure cannot silence the poll, while a real signed-out stops the asking.
			*
			* A ref, not state: making it a dependency would re-arm the interval on every
			* sign-in, restarting the minute and re-reading immediately on top of the
			* read that just changed it.
			*/
			const signedOut = (0, react.useRef)(false);
			const mounted = (0, react.useRef)(true);
			/** Number of the newest read that may write; assigned when a read starts. */
			const readSeq = (0, react.useRef)(0);
			/** Manual requests in flight, so unmount can abort them like the poll's. */
			const inFlight = (0, react.useRef)(/* @__PURE__ */ new Set());
			(0, react.useEffect)(() => {
				mounted.current = true;
				return () => {
					mounted.current = false;
					for (const controller of inFlight.current) controller.abort();
					inFlight.current.clear();
				};
			}, []);
			/** Register a manual request so unmount aborts it. */
			const track = (0, react.useCallback)(() => {
				const controller = new AbortController();
				inFlight.current.add(controller);
				return controller;
			}, []);
			/**
			* Read the status document and apply it.
			* @returns whether this read produced the document now on screen.
			*/
			const read = (0, react.useCallback)(async (signal) => {
				const seq = ++readSeq.current;
				const current = () => mounted.current && signal?.aborted !== true && seq === readSeq.current;
				try {
					const response = await fetch(variant.statusPath, {
						headers: { accept: "application/json" },
						credentials: "same-origin",
						...signal === void 0 ? {} : { signal }
					});
					const value = await response.json().catch(() => void 0);
					if (!response.ok) throw new Error(`HTTP ${response.status}`);
					if (!isWorkBuddyWebStatus(value)) throw new Error(t("statusResponseInvalid"));
					if (!current()) return false;
					setStatus(value);
					if (value.status === "signed-in") signedOut.current = false;
					else if (value.status === "signed-out") signedOut.current = true;
					setReadFailure(void 0);
					return true;
				} catch (error) {
					const message = error instanceof Error ? error.message : t("requestFailed");
					if (current()) {
						setReadFailure(message);
						setStatus((previous) => previous ?? {
							status: "error",
							message
						});
					}
					return false;
				}
			}, [t, variant.statusPath]);
			/**
			* POST one control action, then re-read so the host's truth is what stays.
			*
			* The key travels in a header, not the body: it authorizes the write, and
			* the host never accepts a prompt, a sentinel, or a model outside its own
			* catalog from here.
			*/
			const control = (0, react.useCallback)(async (action) => {
				const key = status?.status === "signed-in" ? status.probeKey : void 0;
				if (key === void 0) return;
				const perRow = action.action === "set-model-visibility";
				if (perRow) setToggling((previous) => new Set(previous).add(action.model));
				else setBusy(true);
				const controller = track();
				try {
					const response = await fetch(variant.probePath, {
						method: "POST",
						headers: {
							"Content-Type": "application/json",
							"X-WorkBuddy-Probe-Key": key
						},
						credentials: "same-origin",
						signal: controller.signal,
						body: JSON.stringify(action)
					});
					const value = await response.json().catch(() => void 0);
					if (!response.ok) throw new Error(errorMessage(value, response.status));
					if (action.action === "set-model-visibility" && fieldOf(value, "state") !== "updated") {
						if (fieldOf(value, "state") === "stale-account") {
							await read(controller.signal);
							throw new Error(t("visibilityStaleAccount"));
						}
						throw new Error(fieldOf(value, "reason") ?? t("requestFailed"));
					}
					await read(controller.signal);
				} catch (error) {
					if (mounted.current && controller.signal.aborted !== true) setReadFailure(error instanceof Error ? error.message : t("requestFailed"));
				} finally {
					inFlight.current.delete(controller);
					if (mounted.current) {
						if (perRow) setToggling((previous) => {
							const next = new Set(previous);
							if (action.action === "set-model-visibility") next.delete(action.model);
							return next;
						});
						else setBusy(false);
					}
				}
			}, [
				read,
				status,
				t,
				track,
				variant.probePath
			]);
			/**
			* The poll. Armed on mount and disarmed on unmount; a genuine signed-out
			* answer makes it skip its turns rather than clear itself, so signing in on
			* the desktop is picked up within the minute instead of needing a click.
			*/
			(0, react.useEffect)(() => {
				const controller = new AbortController();
				read(controller.signal);
				const timer = window.setInterval(() => {
					if (signedOut.current) return;
					read(controller.signal);
				}, POLL_INTERVAL_MS);
				return () => {
					window.clearInterval(timer);
					controller.abort();
				};
			}, [read]);
			return {
				status,
				readFailure,
				busy,
				toggling,
				refresh: (0, react.useCallback)(async () => {
					setBusy(true);
					const controller = track();
					try {
						await read(controller.signal);
					} finally {
						inFlight.current.delete(controller);
						if (mounted.current) setBusy(false);
					}
				}, [read, track]),
				refreshModels: (0, react.useCallback)(() => control({ action: "refresh" }), [control]),
				detect: (0, react.useCallback)((model) => control({
					action: "probe",
					model
				}), [control]),
				clearDetections: (0, react.useCallback)(() => control({ action: "clear" }), [control]),
				setVisibility: (0, react.useCallback)((model, visible, account) => control({
					action: "set-model-visibility",
					model,
					visible,
					account
				}), [control])
			};
		}
		/** Read one string field out of an unknown JSON body. */
		function fieldOf(value, field) {
			if (typeof value !== "object" || value === null) return void 0;
			const found = value[field];
			return typeof found === "string" ? found : void 0;
		}
		/** The reason a rejected control response carries, or the HTTP status. */
		function errorMessage(value, status) {
			return fieldOf(value, "error") ?? fieldOf(value, "reason") ?? `HTTP ${status}`;
		}
		//#endregion
		//#region src/client/WorkBuddyCard.tsx
		/**
		* One WorkBuddy variant's card.
		*
		* The shell is the host's own `DisclosureRow`, so the card inherits the Plugins
		* page's disclosure chrome, keyboard handling, and theme instead of shipping a
		* hand-built expandable container. What remains plugin-owned is the *content*:
		* the account state, where the model list came from, the credit breakdown, the
		* context windows with their per-account visibility controls, and the
		* reasoning-effort detection.
		*/
		/**
		* The state dot's semantic.
		*
		* Takes `'loading'` as well as the document's own states: before the first
		* response the card knows nothing about the account, so it must not borrow the
		* signed-out grey — that would read as "nothing is wrong, nobody is signed in"
		* when the truth is "not read yet".
		*/
		function dotState(status) {
			if (status === void 0) return "ongoing";
			if (status.status === "signed-in") return "done";
			return status.status === "error" ? "error" : "idle";
		}
		/** The one-line account state. `undefined` status is "not read yet", not signed-out. */
		function accountLabel(status, t) {
			if (status === void 0) return t("loading");
			if (status.status === "signed-in") return status.nickname === void 0 ? t("signedIn") : t("signedInAs", { nickname: status.nickname });
			return status.status === "error" ? t("requestFailed") : t("signedOut");
		}
		/** Where the model list on screen came from, and when. */
		function catalogProvenance(catalog, t) {
			const when = catalog.fetchedAt === void 0 ? void 0 : formatTime(catalog.fetchedAt);
			const line = catalog.source === "live" && when !== void 0 ? t("catalogLive", { time: when }) : catalog.source === "saved" && when !== void 0 ? t("catalogSaved", { time: when }) : t("catalogFallback");
			return catalog.appVersion === void 0 ? line : `${line} · ${t("catalogAppVersion", { version: catalog.appVersion })}`;
		}
		/** Render one variant's live status card. */
		function WorkBuddyCard({ variant, t }) {
			const [open, setOpen] = (0, react.useState)(false);
			const [tab, setTab] = (0, react.useState)("credits");
			const { status, readFailure, busy, toggling, refresh, refreshModels, detect, clearDetections, setVisibility } = useWorkBuddyStatus(variant, t);
			const baseId = (0, react.useId)();
			const creditsTab = {
				value: "credits",
				label: t("tabCredits"),
				id: `${baseId}-tab-credits`,
				panelId: `${baseId}-panel-credits`
			};
			const modelsTab = {
				value: "models",
				label: t("tabModels"),
				id: `${baseId}-tab-models`,
				panelId: `${baseId}-panel-models`
			};
			const probeTab = {
				value: "probe",
				label: t("tabProbe"),
				id: `${baseId}-tab-probe`,
				panelId: `${baseId}-panel-probe`
			};
			const tabs = [
				creditsTab,
				modelsTab,
				probeTab
			];
			/**
			* The failure the assist block covers, when this document has one. Computed
			* once so the block and the refresh button agree on which one owns the
			* re-check — showing both would put two buttons with the same effect side by
			* side.
			*/
			const assistCode = status?.status === "signed-out" ? assistCodeFor(status.reasonCode) : void 0;
			const signedIn = status?.status === "signed-in" ? status : void 0;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.DisclosureRow, {
				icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, { state: dotState(status) }),
				title: t(variant.titleKey),
				titleClassName: workbuddy_module_css_default.summaryTitle,
				rowClassName: workbuddy_module_css_default.summaryRow,
				open,
				expandable: true,
				expandOnRowClick: true,
				onToggle: () => {
					setOpen(!open);
				},
				collapsedContent: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
					className: workbuddy_module_css_default.statusLine,
					role: "status",
					"aria-busy": status === void 0,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, { state: dotState(status) }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: accountLabel(status, t) })]
				}),
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: workbuddy_module_css_default.body,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: workbuddy_module_css_default.section,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h4", {
									className: workbuddy_module_css_default.title,
									children: t("accountHeading")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: workbuddy_module_css_default.row,
									children: assistCode === void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
										size: "sm",
										disabled: busy,
										onClick: () => {
											refresh();
										},
										children: busy ? t("refreshing") : t("refresh")
									}) : null
								}),
								readFailure === void 0 || status === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: workbuddy_module_css_default.error,
									children: t("statusRefreshFailed", { message: readFailure })
								}),
								signedIn?.expiresAt === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: workbuddy_module_css_default.text,
									children: t("accessTokenExpires", { time: formatTime(signedIn.expiresAt) })
								})
							]
						}),
						signedIn === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
							signedIn.catalog === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: workbuddy_module_css_default.row,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: workbuddy_module_css_default.text,
									children: catalogProvenance(signedIn.catalog, t)
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
									size: "sm",
									disabled: busy,
									onClick: () => {
										refreshModels();
									},
									children: busy ? t("refreshingModels") : t("refreshModels")
								})]
							}),
							signedIn.catalog?.error === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: workbuddy_module_css_default.error,
								children: t("catalogError", { message: signedIn.catalog.error })
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.SegmentedTabs, {
								items: tabs,
								value: tab,
								onChange: setTab,
								label: t("tabLabel")
							}),
							tab === "credits" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: workbuddy_module_css_default.section,
								id: creditsTab.panelId,
								role: "tabpanel",
								"aria-labelledby": creditsTab.id,
								children: [
									signedIn.credits === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: workbuddy_module_css_default.section,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
											className: workbuddy_module_css_default.row,
											children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: workbuddy_module_css_default.title,
												children: signedIn.credits.unlimited === true ? t("creditsTotalUnlimited") : t("creditsTotal", { total: formatNumber(signedIn.credits.total) })
											})
										}), signedIn.credits.cycleResetTime === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
											className: workbuddy_module_css_default.dim,
											children: t("cycleResetAt", { time: formatCycleReset(signedIn.credits.cycleResetTime) })
										})]
									}),
									signedIn.credits === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CreditsPanel, {
										credits: signedIn.credits,
										t
									}),
									signedIn.creditsError === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										className: workbuddy_module_css_default.error,
										children: t("creditsError", { message: signedIn.creditsError })
									})
								]
							}) : tab === "models" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: workbuddy_module_css_default.section,
								id: modelsTab.panelId,
								role: "tabpanel",
								"aria-labelledby": modelsTab.id,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ModelsPanel, {
									models: signedIn.models,
									visibility: signedIn.visibility,
									toggling,
									disabled: busy,
									t,
									onToggle: (model, visible, account) => {
										setVisibility(model, visible, account);
									}
								})
							}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: workbuddy_module_css_default.section,
								id: probeTab.panelId,
								role: "tabpanel",
								"aria-labelledby": probeTab.id,
								children: signedIn.probe === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ProbePanel, {
									probe: signedIn.probe,
									models: signedIn.models,
									busy,
									t,
									onDetect: (model) => {
										detect(model);
									},
									onClear: () => {
										clearDetections();
									}
								})
							})
						] }),
						status?.status === "signed-out" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: status.reason === void 0 ? workbuddy_module_css_default.text : workbuddy_module_css_default.error,
							children: status.reason ?? t(variant.signedOutKey)
						}), assistCode === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(AssistBlock, {
							variant,
							code: assistCode,
							busy,
							t,
							onRecheck: () => {
								refresh();
							}
						})] }) : null,
						status?.status === "error" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: workbuddy_module_css_default.error,
							children: status.message
						}) : null
					]
				})
			});
		}
		/** Both variants, in display order. */
		const CARD_VARIANTS = [{
			id: "workbuddy",
			titleKey: "title",
			signedOutKey: "signedOutHint",
			statusPath: "/plugins/dsh-workbuddy-bridge/status",
			probePath: "/plugins/dsh-workbuddy-bridge/probe",
			appName: "WorkBuddy",
			unavailableKey: "assistUnavailableCN"
		}, {
			id: "workbuddy-ai",
			titleKey: "titleAI",
			signedOutKey: "signedOutHintAI",
			statusPath: "/plugins/dsh-workbuddy-bridge/ai/status",
			probePath: "/plugins/dsh-workbuddy-bridge/ai/probe",
			appName: "WorkBuddy AI",
			unavailableKey: "assistUnavailableAI"
		}];
		/** The card (and therefore the routes) a selected provider belongs to. */
		function cardVariantFor(provider) {
			return CARD_VARIANTS.find((card) => card.id === provider);
		}
		//#endregion
		//#region src/client/locales.ts
		/** English copy. */
		const en = {
			title: "WorkBuddy (CN)",
			intro: "Follows the sign-in of the WorkBuddy desktop app and serves its models here.",
			titleAI: "WorkBuddy AI (Global)",
			loading: "Loading account…",
			signedOut: "Not signed in",
			signedOutHint: "Sign in once in the WorkBuddy desktop app; this plugin follows that sign-in automatically.",
			signedOutHintAI: "Sign in once in the WorkBuddy AI desktop app; this plugin follows that sign-in automatically.",
			signedIn: "Signed in",
			signedInAs: "Signed in as {nickname}",
			accessTokenExpires: "Sign-in expires {time}; it renews automatically.",
			accountHeading: "Account",
			requestFailed: "Request failed",
			statusRefreshFailed: "Refresh failed: {message} — showing the last known state",
			statusResponseInvalid: "WorkBuddy returned an unreadable status reply",
			catalogLive: "Model list updated {time}",
			catalogSaved: "Showing the saved model list from {time}",
			catalogFallback: "Showing the built-in model list (not yet updated from WorkBuddy)",
			catalogError: "Last update failed: {message}",
			catalogAppVersion: "App version {version}",
			refresh: "Refresh",
			refreshing: "Refreshing…",
			refreshModels: "Refresh model list",
			refreshingModels: "Refreshing models…",
			tabLabel: "WorkBuddy detail",
			tabCredits: "Credits",
			tabModels: "Models",
			tabProbe: "Detection",
			creditsTotal: "Total: {total}",
			creditsTotalUnlimited: "Total: Unlimited",
			unlimitedQuota: "Unlimited",
			packageEnterprise: "Enterprise quota",
			cycleResetAt: "Resets {time}",
			percentRemaining: "{percent}% remaining",
			percentUnknown: "Remaining share unknown",
			exactRemaining: "{remain} / {size} remaining",
			creditPackageUnknownSize: "{remain} remaining",
			creditsError: "Credit unavailable: {message}",
			freeModel: "Free",
			badgeLimitedFree: "Limited-time free",
			badgeNightDiscount: "Night discount",
			badgeFreeNow: "Free for now",
			rate: "{rate} credits per message",
			rateUnknown: "Price unavailable — refresh to update",
			contextUpTo: "up to {size}",
			contextDefault: "default {size}",
			contextUnknown: "no declared context window",
			visibilityIntro: "Uncheck a model to hide it from the picker. The choice is saved per signed-in account; chats already using a hidden model keep working.",
			visibilityStaleAccount: "The signed-in account changed — this change was not saved.",
			probeCostNote: "Some models reason but declare no selectable effort levels. Detecting sends a few real requests to one model and may consume a small amount of credit.",
			probeStart: "Detect",
			probeRedetect: "Detect again",
			probeRunning: "Detecting {model}…",
			probeClear: "Clear results",
			probeResultNotValidating: "This model does not check the effort parameter",
			probeResultUnknown: "Detection did not complete",
			probeResultAt: "Detected {time}",
			probeResultEmpty: "No models need detecting right now.",
			probeFailed: "Detection failed: {message}",
			probeLabel: "Reasoning levels",
			probePanelLevels: "Supported levels",
			probePanelNone: "Not detected yet",
			probePanelNote: "Detection sends a few requests to this model and may consume a small amount of credit.",
			probePanelDetect: "Detect",
			probePanelDetecting: "Detecting…",
			probePanelRedetect: "Detect again",
			probePanelNotValidating: "This model does not check the effort parameter.",
			probePanelFailed: "Detection did not finish. You can run it again.",
			probeTooltipIdle: "Detect the reasoning levels {model} supports",
			probeTooltipLevels: "Supported levels: {levels}",
			probeTooltipNotValidating: "This model ignores the reasoning-level parameter",
			probeTooltipFailed: "Detection did not finish · click to run it again",
			authFile: "WorkBuddy auth file",
			authFileHint: "Path to the WorkBuddy desktop auth file. Leave blank to use the app’s own location.",
			authFileAI: "WorkBuddy AI auth file",
			authFileAIHint: "Path to the WorkBuddy AI desktop auth file. Leave blank to use the app’s own location.",
			probeConsent: "Allow reasoning-effort detection",
			probeConsentHint: "Lets the plugin send test requests to a model to confirm which effort levels it accepts; each detection may consume a small amount of credit.",
			maximumContextWindow: "Use the largest declared context window",
			maximumContextWindowHint: "Applies to WorkBuddy AI models that offer a larger window.",
			overridden: "Overridden",
			reset: "Reset to default",
			readOnly: "This deployment stores settings read-only.",
			unavailable: "This plugin is not loaded, so it cannot be configured right now.",
			save: "Save",
			saving: "Saving…",
			saveFailed: "The deployment did not accept these values; they were left for you to correct.",
			assistantHeading: "Let an Agent sort this out",
			assistantIntro: "Send the request below to your Agent; it will check the app location and the launch configuration for you.",
			assistantCopy: "Copy for Agent",
			assistantCopied: "Copied",
			assistantCopyFailed: "Copy failed — select the text above and copy it manually",
			assistantAfter: "When your Agent is done, come back and check again. If the DSH launch environment was changed, restart DSH first as instructed.",
			assistantRecheck: "Done — check again",
			assistantRechecking: "Checking…",
			assistantPrompt: "DSH's dsh-workbuddy-bridge cannot use my {appName}: {failureSummary}. Please check the actual installation location and any existing path configuration, help the plugin use it correctly, and verify recovery. If the DSH launch environment must be changed or DSH restarted, give me clear steps; do not only set an environment variable temporarily in the current shell.",
			assistNotFound: "no usable decryption program was found",
			assistAmbiguous: "more than one WorkBuddy copy was found and none could be chosen safely",
			assistIncomplete: "the automatic search could not be completed",
			assistPathInvalid: "the configured program path is not usable",
			assistUnavailableCN: "no decryption program is configured for this platform",
			assistUnavailableAI: "no decryption program is configured for WorkBuddy AI"
		};
		/** Simplified Chinese copy. */
		const zh = {
			title: "WorkBuddy（国内版）",
			intro: "跟随 WorkBuddy 桌面 App 的登录状态，在此直接使用它的模型。",
			titleAI: "WorkBuddy AI（国际版）",
			loading: "正在读取账号…",
			signedOut: "未登录",
			signedOutHint: "在 WorkBuddy 桌面 App 里登录一次即可，插件会自动跟随当前登录的账号。",
			signedOutHintAI: "在 WorkBuddy AI 国际版桌面 App 里登录一次即可，插件会自动跟随当前登录的账号。",
			signedIn: "已登录",
			signedInAs: "已登录：{nickname}",
			accessTokenExpires: "登录将于 {time} 过期，届时自动续期。",
			accountHeading: "账号",
			requestFailed: "请求失败",
			statusRefreshFailed: "刷新失败：{message} — 当前显示的是上次成功获取的状态",
			statusResponseInvalid: "WorkBuddy 返回的状态数据无法识别",
			catalogLive: "模型列表更新于 {time}",
			catalogSaved: "当前显示已保存的模型列表，更新于 {time}",
			catalogFallback: "当前显示内置模型列表（尚未从 WorkBuddy 更新）",
			catalogError: "上次更新失败：{message}",
			catalogAppVersion: "App 版本 {version}",
			refresh: "刷新",
			refreshing: "正在刷新…",
			refreshModels: "刷新模型列表",
			refreshingModels: "正在刷新模型…",
			tabLabel: "WorkBuddy 详情",
			tabCredits: "积分",
			tabModels: "模型",
			tabProbe: "检测",
			creditsTotal: "合计：{total}",
			creditsTotalUnlimited: "合计：不限额",
			unlimitedQuota: "不限额",
			packageEnterprise: "企业额度",
			cycleResetAt: "重置时间：{time}",
			percentRemaining: "剩余 {percent}%",
			percentUnknown: "剩余占比未知",
			exactRemaining: "剩余 {remain} / {size}",
			creditPackageUnknownSize: "剩余 {remain}",
			creditsError: "积分查询失败：{message}",
			freeModel: "免费",
			badgeLimitedFree: "限时免费",
			badgeNightDiscount: "夜间折扣",
			badgeFreeNow: "当前免费",
			rate: "{rate} 积分/次",
			rateUnknown: "价格未知 — 刷新后更新",
			contextUpTo: "最高 {size}",
			contextDefault: "默认 {size}",
			contextUnknown: "未声明上下文窗口",
			visibilityIntro: "取消勾选即可将该模型从选择器中隐藏；按登录账号分别保存，已在用该模型的会话不受影响。",
			visibilityStaleAccount: "登录账号已切换——本次修改未保存。",
			probeCostNote: "部分模型具备思考能力，但没有声明可选档位。检测会向一个模型发送少量真实请求以确认可用档位，可能消耗少量积分。",
			probeStart: "开始检测",
			probeRedetect: "重新检测",
			probeRunning: "正在检测 {model}…",
			probeClear: "清除结果",
			probeResultNotValidating: "该模型不校验档位参数",
			probeResultUnknown: "检测未完成",
			probeResultAt: "检测于 {time}",
			probeResultEmpty: "当前没有需要检测的模型。",
			probeFailed: "检测失败：{message}",
			probeLabel: "推理档位",
			probePanelLevels: "支持的档位",
			probePanelNone: "尚未检测",
			probePanelNote: "检测会向该模型发送若干请求，可能消耗少量积分。",
			probePanelDetect: "检测",
			probePanelDetecting: "检测中…",
			probePanelRedetect: "重新检测",
			probePanelNotValidating: "该模型不校验档位参数。",
			probePanelFailed: "检测未完成，可以再检测一次。",
			probeTooltipIdle: "检测 {model} 支持的推理档位",
			probeTooltipLevels: "支持的档位：{levels}",
			probeTooltipNotValidating: "该模型忽略推理档位参数",
			probeTooltipFailed: "检测未完成 · 点击可再检测一次",
			authFile: "WorkBuddy 登录文件",
			authFileHint: "WorkBuddy 桌面 App 登录文件的路径。留空表示使用应用自身的位置。",
			authFileAI: "WorkBuddy AI 登录文件",
			authFileAIHint: "WorkBuddy AI 桌面 App 登录文件的路径。留空表示使用应用自身的位置。",
			probeConsent: "允许推理档位检测",
			probeConsentHint: "允许插件向模型发送检测请求，以确认它接受哪些推理档位；每次检测可能消耗少量积分。",
			maximumContextWindow: "使用上游声明的最大上下文窗口",
			maximumContextWindowHint: "仅作用于 WorkBuddy AI 中声明了更大窗口的模型。",
			overridden: "已覆盖",
			reset: "恢复默认",
			readOnly: "本部署的设置为只读。",
			unavailable: "该插件当前未加载，暂时无法配置。",
			save: "保存",
			saving: "保存中…",
			saveFailed: "本部署没有接受这些值，已保留供你修改。",
			assistantHeading: "让 Agent 帮你处理",
			assistantIntro: "把下面这段请求发给你的 Agent，它会协助检查应用位置和启动配置。",
			assistantCopy: "复制给 Agent",
			assistantCopied: "已复制",
			assistantCopyFailed: "复制失败，请手动选择上方文字复制",
			assistantAfter: "Agent 处理完成后，回到这里重新检查；如果修改了 DSH 的启动环境，请先按指引重启 DSH。",
			assistantRecheck: "已处理，重新检查",
			assistantRechecking: "正在检查…",
			assistantPrompt: "DSH 的 dsh-workbuddy-bridge 无法使用我的 {appName}：{failureSummary}。请帮我检查实际安装位置和已有路径配置，让插件能正确使用它，并验证恢复结果；如果需要修改 DSH 的启动环境或重启，请给我明确的操作步骤，不要只在当前 shell 临时设置环境变量。",
			assistNotFound: "没有找到可用的解密程序",
			assistAmbiguous: "找到了多个 WorkBuddy 副本，无法安全自动选择",
			assistIncomplete: "自动定位未能完成",
			assistPathInvalid: "指定的程序路径不可用",
			assistUnavailableCN: "当前平台尚未配置解密程序",
			assistUnavailableAI: "尚未配置 WorkBuddy AI 的解密程序"
		};
		/** The form frame's copy, read from this plugin's dictionary. */
		function formLabels(t) {
			return {
				unavailable: t("unavailable"),
				readOnly: t("readOnly"),
				saveFailed: t("saveFailed"),
				save: t("save"),
				saving: t("saving")
			};
		}
		//#endregion
		//#region src/client/WorkBuddyConfigPage.tsx
		/** Stable field ids, so the labels and the panel ids agree across renders. */
		const FIELD_IDS = {
			authFile: "workbuddy-config-auth-file",
			authFileAI: "workbuddy-config-auth-file-ai"
		};
		/**
		* Render the bundle's page: the one-liner a summary seat asks for, or the form
		* and the live cards.
		*/
		function WorkBuddyConfigPage(props) {
			const { t } = props;
			if (props.view === "summary") return t("intro");
			const state = props.useWorkbuddyConfig((snapshot) => snapshot);
			const disabled = !state.writable;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: workbuddy_module_css_default.page,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.SettingsForm, {
					labels: formLabels(t),
					state,
					onSave: props.save,
					onDiscard: props.discard,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.SettingsValueField, {
							id: FIELD_IDS.authFile,
							label: t("authFile"),
							hint: t("authFileHint"),
							overriddenLabel: t("overridden"),
							resetLabel: t("reset"),
							invalidLabel: t("saveFailed"),
							disabled,
							...state.authFile,
							onEdit: (text) => {
								props.edit("authFile", text);
							},
							onReset: () => {
								props.resetField("authFile");
							}
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.SettingsValueField, {
							id: FIELD_IDS.authFileAI,
							label: t("authFileAI"),
							hint: t("authFileAIHint"),
							overriddenLabel: t("overridden"),
							resetLabel: t("reset"),
							invalidLabel: t("saveFailed"),
							disabled,
							...state.authFileAI,
							onEdit: (text) => {
								props.edit("authFileAI", text);
							},
							onReset: () => {
								props.resetField("authFileAI");
							}
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: workbuddy_module_css_default.toggleRow,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: workbuddy_module_css_default.toggleLabel,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("probeConsent") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: workbuddy_module_css_default.toggleHint,
									children: t("probeConsentHint")
								})]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Switch, {
								checked: state.probeConsent.text === "true",
								disabled,
								label: t("probeConsent"),
								onChange: (next) => {
									props.edit("probeConsent", next ? "true" : "false");
								}
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: workbuddy_module_css_default.toggleRow,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: workbuddy_module_css_default.toggleLabel,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("maximumContextWindow") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: workbuddy_module_css_default.toggleHint,
									children: t("maximumContextWindowHint")
								})]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Switch, {
								checked: state.useMaximumContextWindow.text === "true",
								disabled,
								label: t("maximumContextWindow"),
								onChange: (next) => {
									props.edit("useMaximumContextWindow", next ? "true" : "false");
								}
							})]
						})
					]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: workbuddy_module_css_default.cards,
					children: CARD_VARIANTS.map((variant) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(WorkBuddyCard, {
						variant,
						t
					}, variant.id))
				})]
			});
		}
		//#endregion
		//#region \0workbuddy-css:D:\ProjectSomething\dsh-plugins\dsh-workbuddy-bridge\src\client\probe-control.module.css.js
		const css = ".Ivd5xG_wrapper{align-items:center;display:inline-flex;position:relative}.Ivd5xG_trigger{corner-shape:round;cursor:pointer;width:28px;height:28px;color:var(--dsw-alias-label-secondary);background:0 0;border:none;border-radius:999px;flex:none;justify-content:center;align-items:center;padding:0;display:inline-flex;position:relative}.Ivd5xG_trigger:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}.Ivd5xG_trigger:disabled{cursor:default;color:var(--dsw-alias-label-dimmed)}.Ivd5xG_trigger:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:1px}.Ivd5xG_trigger[aria-busy=true] svg{transform-origin:50%;animation:1.2s linear infinite Ivd5xG_wb-probe-spin}@keyframes Ivd5xG_wb-probe-spin{to{transform:rotate(360deg)}}@media (prefers-reduced-motion:reduce){.Ivd5xG_trigger[aria-busy=true] svg{animation:none}}.Ivd5xG_panel{isolation:isolate;z-index:1100;box-sizing:border-box;border-radius:var(--dsw-radius-lg);--dsw-elevation-stroke-color:var(--dsw-alias-border-l1);width:max-content;min-width:min(280px,100vw - 24px);max-width:min(360px,100vw - 24px);box-shadow:var(--dsw-elevation-prominent);color:var(--dsw-alias-label-secondary);cursor:default;border:0;padding:12px;font-size:12px;line-height:1.5;position:fixed}.Ivd5xG_panel:before{z-index:-1;border-radius:inherit;background:var(--dsw-specific-menu);backdrop-filter:var(--dsw-menu-backdrop-filter);content:\"\";pointer-events:none;position:absolute;inset:0}.Ivd5xG_panelTitle{color:var(--dsw-alias-label-primary);align-items:center;gap:8px;font-size:13px;font-weight:500;line-height:1.5;display:flex}.Ivd5xG_panelTitleIcon{color:var(--dsw-alias-label-secondary);flex:none;align-items:center;display:inline-flex}.Ivd5xG_panelTitleText{text-overflow:ellipsis;white-space:nowrap;min-width:0;overflow:hidden}.Ivd5xG_titleRule{border-top:.5px solid var(--dsw-alias-border-l2);margin:8px 0 10px}.Ivd5xG_levelsLabel{color:var(--dsw-alias-label-tertiary);margin:0 0 2px;font-size:12px;line-height:1.5}.Ivd5xG_levels{color:var(--dsw-alias-label-primary);overflow-wrap:anywhere;margin:0;font-size:13px;font-weight:500;line-height:1.5}.Ivd5xG_note,.Ivd5xG_dim{color:var(--dsw-alias-label-tertiary);margin:12px 0 0;font-size:12px;line-height:1.6}.Ivd5xG_dim{margin-top:2px}.Ivd5xG_panelActions{justify-content:flex-end;gap:8px;margin-top:12px;display:flex}";
		const tagId = "dsh-workbuddy-bridge/probe-control.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-workbuddy-bridge";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var probe_control_module_css_default = {
			"dim": "Ivd5xG_dim",
			"levels": "Ivd5xG_levels",
			"levelsLabel": "Ivd5xG_levelsLabel",
			"note": "Ivd5xG_note",
			"panel": "Ivd5xG_panel",
			"panelActions": "Ivd5xG_panelActions",
			"panelTitle": "Ivd5xG_panelTitle",
			"panelTitleIcon": "Ivd5xG_panelTitleIcon",
			"panelTitleText": "Ivd5xG_panelTitleText",
			"titleRule": "Ivd5xG_titleRule",
			"trigger": "Ivd5xG_trigger",
			"wb-probe-spin": "Ivd5xG_wb-probe-spin",
			"wrapper": "Ivd5xG_wrapper"
		};
		//#endregion
		//#region src/client/probe-control.tsx
		/**
		* Per-model reasoning-effort entry beside the Composer's model selector.
		*
		* It is **only an icon** — no inline text. The composer row is shared with the
		* host's own model picker, and a word here competes with the model name for the
		* same glance while adding nothing: the verified levels already appear in the
		* model dropdown (the adapter exposes them as selectable efforts). What the
		* control offers is an *action*, so it is drawn like the other icon-only
		* buttons in this chrome, and its meaning lives in the tooltip and the
		* accessible name.
		*
		* Styling follows `dsh-ds-balance`'s popover button, which copies the host's own
		* sidebar `.iconButton` (28px circle, `--dsw-alias-label-secondary` icon on a
		* transparent background, `--dsw-alias-interactive-bg-hover` on hover). The
		* artwork strokes `currentColor`, so light and dark themes are handled by the
		* token rather than by two sets of colours — no `[data-ds-dark-theme]` selector
		* and no hard-coded colour anywhere.
		*
		* - a **hover/focus tooltip** carries the state and the click's purpose, and is
		*   also the button's `aria-label`.
		* - the **confirmation** is a popover anchored to the control, not a
		*   `window.confirm`. Probing spends real credit, so a confirmation stays — but
		*   it belongs next to the thing it acts on.
		*
		* The popover surface follows `dsh-ds-balance`'s balance popover, which itself
		* copies the host's own stat dialog: a portal to `document.body`, positioned by
		* the host's `useAnchoredPosition`, dismissed by the host's
		* `useDismissOnOutsidePointer`, skinned with `--dsw-specific-menu` plus
		* `--dsw-menu-backdrop-filter` (the pair the host requires together — fill
		* alone is "translucent but not frosted").
		*
		* **The filter must not sit on the panel itself**: a non-`none`
		* `backdrop-filter` makes the element the containing block for its fixed
		* descendants, and this panel contains non-portal `Tooltip` bubbles. The fill
		* and the filter therefore live on an isolated `::before`, exactly as the host
		* does it.
		*
		* @module dsh-workbuddy-bridge/client/probe-control
		*/
		/** How often the control re-checks state when the window regains focus. */
		const RECONCILE_MS = 6e4;
		/**
		* What the popover renders on its first frame: positioned but invisible, so the
		* anchor hook can measure it before deciding where it really goes. Copied
		* verbatim from the host's stat dialog via `dsh-ds-balance`.
		*/
		const MEASURE_STYLE = {
			visibility: "hidden",
			left: 0,
			top: 0
		};
		/** Gap between the control and the popover, and the viewport margin it keeps. */
		const POPOVER_GAP = 8;
		const POPOVER_MARGIN = 12;
		/** Pick the model's recorded observation out of the probe section. */
		function resultFor(status, model) {
			if (status.status !== "signed-in") return void 0;
			return status.probe?.results.find((result) => result.id === model);
		}
		/**
		* What hovering the icon says: the levels this model accepts, when they are
		* known.
		*
		* The answer is the *result*, not the action — a user hovering a small glyph
		* beside the model picker is asking "what does this model support?", and the
		* action is what the panel they can open is for.
		*
		* A recorded result outranks a remembered failure: `failed` only means "the last
		* run from this control did not finish", and the host can record a result for
		* the same model at any time (a detection started from the settings card,
		* another conversation, or a finished sweep). The levels the user already paid
		* for are the better answer; failure copy is what remains when there is none.
		*/
		function tooltipText(t, model, state) {
			if (state.busy) return t("probeRunning", { model });
			const result = state.result;
			if (result !== void 0) {
				if (result.validation === "validating" && result.efforts.length > 0) return t("probeTooltipLevels", { levels: result.efforts.join(" / ") });
				if (result.validation === "non-validating") return t("probeTooltipNotValidating");
				return t("probeTooltipFailed");
			}
			return state.failed ? t("probeTooltipFailed") : t("probeTooltipIdle", { model });
		}
		/** The levels this model accepts, as one line; undefined when there are none to show. */
		function levelsLine(result) {
			if (result === void 0) return void 0;
			if (result.validation === "validating" && result.efforts.length > 0) return result.efforts.join(" / ");
		}
		/** Model-independent shell: resolves the selection, then delegates per model. */
		function WorkBuddyProbeControl({ directory, t }) {
			const subscribe = (0, react.useCallback)((listener) => directory.subscribe(listener), [directory]);
			const snapshot = (0, react.useCallback)(() => directory.getSnapshot(), [directory]);
			const selection = (0, react.useSyncExternalStore)(subscribe, snapshot, snapshot).current;
			const card = selection === void 0 ? void 0 : cardVariantFor(selection.provider);
			if (card === void 0 || selection === void 0) return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ModelProbe, {
				model: selection.model,
				card,
				t
			}, `${card.id}:${selection.model}`);
		}
		function ModelProbe({ model, card, t }) {
			const [status, setStatus] = (0, react.useState)();
			const [busy, setBusy] = (0, react.useState)(false);
			/**
			* Whether the panel is open.
			*
			* One flag, not a confirmation-plus-result pair: the panel shows the same
			* thing before and after a run (the levels, and the one button that gets
			* them), so there is no second state to model. Opening it is not a commitment
			* either — the button inside is.
			*/
			const [open, setOpen] = (0, react.useState)(false);
			const [failed, setFailed] = (0, react.useState)(false);
			/**
			* The outcome of the run this control just performed.
			*
			* Kept so a fresh answer is shown immediately, without waiting for the next
			* status read; `result` from the document is what stands when there is none.
			*/
			const [fresh, setFresh] = (0, react.useState)();
			const inFlight = (0, react.useRef)(false);
			const mounted = (0, react.useRef)(false);
			const readSeq = (0, react.useRef)(0);
			/** The control itself: the popover's anchor and the "inside" test for dismissal. */
			const rootRef = (0, react.useRef)(null);
			/**
			* The panel, portalled to `document.body` so it is not clipped by the composer
			* row. It is measured by the anchor hook and passed to the outside-pointer test,
			* which would otherwise read a click on the panel as a click outside it.
			*/
			const panelRef = (0, react.useRef)(null);
			const refresh = (0, react.useCallback)(async (signal) => {
				const seq = ++readSeq.current;
				const response = await fetch(card.statusPath, {
					credentials: "same-origin",
					headers: { accept: "application/json" },
					...signal === void 0 ? {} : { signal }
				});
				if (!response.ok) throw new Error(`HTTP ${response.status}`);
				const value = await response.json().catch(() => void 0);
				if (!isWorkBuddyWebStatus(value)) throw new Error(t("statusResponseInvalid"));
				if (mounted.current && signal?.aborted !== true && seq === readSeq.current) setStatus(value);
			}, [card.statusPath, t]);
			(0, react.useEffect)(() => {
				mounted.current = true;
				const controller = new AbortController();
				const load = () => {
					refresh(controller.signal).catch(() => {});
				};
				load();
				const timer = window.setInterval(load, RECONCILE_MS);
				window.addEventListener("focus", load);
				return () => {
					mounted.current = false;
					controller.abort();
					window.clearInterval(timer);
					window.removeEventListener("focus", load);
				};
			}, [refresh]);
			const probe = status?.status === "signed-in" ? status.probe : void 0;
			const key = status?.status === "signed-in" ? status.probeKey : void 0;
			const result = status === void 0 ? void 0 : resultFor(status, model);
			const visible = probe?.candidates.includes(model) === true || result !== void 0;
			(0, react.useEffect)(() => {
				if (result !== void 0) setFailed(false);
			}, [result]);
			(0, react.useEffect)(() => {
				setOpen(false);
				setFresh(void 0);
			}, [model]);
			const detect = async () => {
				if (key === void 0 || inFlight.current || probe?.running === true) return;
				inFlight.current = true;
				setFresh(void 0);
				setBusy(true);
				setFailed(false);
				try {
					const response = await fetch(card.probePath, {
						method: "POST",
						credentials: "same-origin",
						headers: {
							"Content-Type": "application/json",
							"X-WorkBuddy-Probe-Key": key
						},
						body: JSON.stringify({
							action: "probe",
							model
						})
					});
					const body = await response.json();
					if (!response.ok || body.state !== "ok" || body.validation !== "validating" && body.validation !== "non-validating" || !Array.isArray(body.efforts) || !body.efforts.every((effort) => typeof effort === "string")) throw new Error("probe failed");
					if (mounted.current) setFresh({
						id: model,
						name: model,
						validation: body.validation,
						efforts: body.efforts,
						probedAt: Date.now()
					});
					refresh().catch(() => {});
				} catch {
					if (mounted.current) setFailed(true);
				} finally {
					inFlight.current = false;
					if (mounted.current) setBusy(false);
				}
			};
			const position = (0, _deepseek_ai_dsh_client_ui_primitives.useAnchoredPosition)({
				open,
				anchorRef: rootRef,
				panelRef,
				side: "top",
				gap: POPOVER_GAP,
				margin: POPOVER_MARGIN
			});
			(0, _deepseek_ai_dsh_client_ui_primitives.useDismissOnOutsidePointer)(rootRef, open, () => {
				setOpen(false);
			}, panelRef);
			if (!visible) return null;
			const text = tooltipText(t, model, {
				busy,
				result,
				failed
			});
			const disabled = busy || probe?.running === true || key === void 0;
			const shown = fresh ?? result;
			const levels = levelsLine(shown);
			const notValidating = shown?.validation === "non-validating";
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
				className: probe_control_module_css_default.wrapper,
				ref: rootRef,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
					label: text,
					side: "top",
					portal: true,
					disabled: open,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: probe_control_module_css_default.trigger,
						"aria-label": text,
						"aria-busy": busy,
						"aria-expanded": open,
						disabled,
						onClick: () => {
							setOpen(!open);
						},
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ProbeIcon, {})
					})
				}), open ? (0, react_dom.createPortal)(/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
					ref: panelRef,
					className: probe_control_module_css_default.panel,
					style: position ?? MEASURE_STYLE,
					role: "dialog",
					"aria-label": t("probeLabel"),
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: probe_control_module_css_default.panelTitle,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: probe_control_module_css_default.panelTitleIcon,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ProbeIcon, {})
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: probe_control_module_css_default.panelTitleText,
								children: model
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: probe_control_module_css_default.titleRule,
							"aria-hidden": true
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: probe_control_module_css_default.levelsLabel,
							children: t("probePanelLevels")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: probe_control_module_css_default.levels,
							role: "status",
							"aria-live": "polite",
							children: levels ?? t("probePanelNone")
						}),
						notValidating ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: probe_control_module_css_default.dim,
							children: t("probePanelNotValidating")
						}) : null,
						failed && shown === void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: probe_control_module_css_default.dim,
							children: t("probePanelFailed")
						}) : null,
						levels === void 0 && !notValidating ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: probe_control_module_css_default.note,
							children: t("probePanelNote")
						}) : null,
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: probe_control_module_css_default.panelActions,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								size: "sm",
								variant: "primary",
								disabled,
								onClick: () => {
									detect();
								},
								children: busy ? t("probePanelDetecting") : levels === void 0 ? t("probePanelDetect") : t("probePanelRedetect")
							})
						})
					]
				}), document.body) : null]
			});
		}
		/**
		* The control's icon — the host's own reasoning glyph.
		*
		* Deliberately **not** a hand-drawn shape. Every icon in this chrome is one of
		* the host's, drawn on the same grid (16-unit viewBox, 1px stroke) with the same
		* `currentColor` convention, so borrowing the host's artwork is the only way to
		* land in the same visual language — anything original reads as foreign beside
		* the model picker it sits next to.
		*
		* `IconThinkOutlineRegular` is the host's semantic icon for reasoning, which is
		* exactly what this control acts on. It is exported from a package this plugin
		* already depends on, so it costs no new dependency edge.
		*/
		function ProbeIcon() {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconThinkOutlineRegular, { size: 16 });
		}
		//#endregion
		//#region src/client/config-controller.ts
		/**
		* A boolean field. Staged as text like every other field, so one save covers
		* the whole form; the control renders the two states, not the string.
		*/
		function settingsBooleanField(field) {
			return {
				field,
				format: (value) => value === true ? "true" : "false",
				parse: (text) => {
					const trimmed = text.trim();
					return trimmed === "true" || trimmed === "false" ? {
						kind: "set",
						value: trimmed === "true"
					} : void 0;
				}
			};
		}
		/** Bridges one Host entry's form onto the page. */
		var WorkBuddyConfigController = class {
			form;
			store;
			constructor(scope) {
				this.form = new _deepseek_ai_dsh_client_ui_primitives.SettingsFormModel(scope, [
					(0, _deepseek_ai_dsh_client_ui_primitives.settingsTextField)("authFile"),
					(0, _deepseek_ai_dsh_client_ui_primitives.settingsTextField)("authFileAI"),
					settingsBooleanField("probeConsent"),
					settingsBooleanField("useMaximumContextWindow")
				]);
				this.store = this.form.bind(() => this.projection());
			}
			projection() {
				return {
					...this.form.shell(),
					authFile: this.form.field("authFile"),
					authFileAI: this.form.field("authFileAI"),
					probeConsent: this.form.field("probeConsent"),
					useMaximumContextWindow: this.form.field("useMaximumContextWindow")
				};
			}
			/** Build the face the page's slot registration injects. */
			inject() {
				return {
					hooks: { workbuddyConfig: this.store },
					...this.form.actions()
				};
			}
			/** Release the form's subscriptions. */
			dispose() {
				this.form.dispose();
			}
		};
		//#endregion
		//#region src/client/index.tsx
		/** Stable browser-plugin name. */
		const name = "dsh-workbuddy-bridge-client";
		/** Dictionary namespace owned by this plugin. */
		const NS = "settings.workbuddy";
		/**
		* The bundle's package name. This is the **slot key**: the Plugins page renders
		* `plugins.bundle.config` as `{ entryKey: pkg.name }`, and only shows the
		* section at all when `ledger.bundles.has(pkg.name)` — and `ledger.bundles` is
		* `keysOf('plugins.bundle.config')`, i.e. the keys we register here.
		*/
		const BUNDLE_NAME = "dsh-workbuddy-bridge";
		/**
		* The loader entry id — `cordis.patch.yml`'s `insert[].id`, and therefore the
		* **settings namespace**.
		*
		* Not the same string as {@link BUNDLE_NAME}, and the difference is load-bearing.
		* `dsh-settings/lib/index.js:432,443` publishes every plugin's `Config` document
		* as `ns: entry.options.id` — the *entry* id, not the package name. The composed
		* profile confirms it:
		*
		* ```yaml
		* # == dsh-workbuddy-bridge
		* - id: llm-workbuddy            # entry id  → settings namespace
		*   name: dsh-workbuddy-bridge   # package   → slot key
		* ```
		*
		* `ctx.configForms.get()` takes a namespace, so this is its argument. Passing
		* the package name instead looks correct and fails **silently**: the host never
		* serves that namespace, `whileServed` never fires, and the configuration page
		* simply never appears — no error, no log, nothing.
		*/
		const ENTRY_ID = "llm-workbuddy";
		/**
		* Client services required by this browser half.
		*
		* `modelDirectories` is absent on purpose: it may arrive after this fiber
		* starts, so the composer seat waits for it inside a scoped callback instead of
		* holding the whole entry back.
		*/
		const inject = [
			"slots",
			"locale",
			"remote",
			"remote.session",
			"configForms"
		];
		/**
		* The host seat this control occupies: the composer's compact-controls row,
		* which the host renders immediately left of its own model selector.
		*
		* Deliberately not `conversation.input.model`: that seat is `single`, the
		* shipped ModelSelect already occupies it at priority 0, and a second
		* registration at that priority throws — the seat's own fail-loud rule. A
		* `list` seat adds an entry beside the shipped one instead of fighting it.
		*/
		const PROBE_SEAT = "conversation.input.right";
		/** Entry id within that seat, so the registration is named in exactly one place. */
		const PROBE_SEAT_ID = "workbuddy-probe";
		function apply(ctx) {
			const t = ctx.locale.bind(NS);
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "dsh-workbuddy-bridge: dictionaries");
			const config = new WorkBuddyConfigController(ctx.configForms.get(ENTRY_ID));
			ctx.effect(() => () => {
				config.dispose();
			}, "dsh-workbuddy-bridge: form subscription");
			ctx.effect(() => ctx.configForms.whileServed([ENTRY_ID], () => ctx.slots.inject("plugins.bundle.config", () => ctx.slots.register({
				name: "plugins.bundle.config",
				key: BUNDLE_NAME,
				locale: NS,
				inject: () => config.inject()
			}, WorkBuddyConfigPage))), "dsh-workbuddy-bridge: configuration page");
			ctx.inject(["modelDirectories"], (scope) => {
				scope.slots.inject(PROBE_SEAT, () => scope.slots.register({
					name: PROBE_SEAT,
					id: PROBE_SEAT_ID,
					inject: (sessionId) => ({
						directory: scope.modelDirectories.directoryFor(sessionId).store,
						t
					})
				}, WorkBuddyProbeControl));
			});
		}
		//#endregion
		exports.BUNDLE_NAME = BUNDLE_NAME;
		exports.ENTRY_ID = ENTRY_ID;
		exports.NS = NS;
		exports.apply = apply;
		exports.inject = inject;
		exports.name = name;
		return module.exports;
	}
});
