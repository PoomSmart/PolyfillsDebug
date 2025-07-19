include $(THEOS)/makefiles/common.mk

include $(THEOS_MAKE_PATH)/tweak.mk

ASSETS_PATH = layout/Library/Application Support/Polyfills

js:
	@for dir in scripts-priority scripts scripts-post; do \
		if [ -d "$$dir" ]; then \
			for file in $$dir/*.js; do \
				if [ -f "$$file" ]; then \
					base=$$(basename "$$file" .js); \
					npx uglify-js "$$file" -o "$(ASSETS_PATH)/$$dir/base/$$base.min.js"; \
				fi; \
			done; \
		fi; \
	done
