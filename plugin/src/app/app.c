#include "app.h"

#include <obs-module.h>
#include <obs-frontend-api.h>
#include <plugin-support.h>
#include <util/platform.h>
#include <util/config-file.h>
#include <media-io/video-io.h>
#include <libavformat/avformat.h>

#include <windows.h>

#define PIPE_NAME "\\\\.\\pipe\\overplay"

static HANDLE overlay_process = NULL;

static void send_pipe_event(const char *buffer) {
	HANDLE pipe = CreateFileA(PIPE_NAME, GENERIC_WRITE, 0, NULL, OPEN_EXISTING, 0, NULL);

	if (pipe == INVALID_HANDLE_VALUE) {
		return;
	}

	DWORD written;
	WriteFile(pipe, buffer, (DWORD)strlen(buffer), &written, NULL);
	CloseHandle(pipe);
}

static double get_clip_duration_from_file(const char *path) {
	AVFormatContext *fmt_ctx = NULL;

	if (avformat_open_input(&fmt_ctx, path, NULL, NULL) < 0) {
		return 0.0;
	}

	if (avformat_find_stream_info(fmt_ctx, NULL) < 0) {
		avformat_close_input(&fmt_ctx);
		return 0.0;
	}

	double duration = 0.0;

	if (fmt_ctx->duration != AV_NOPTS_VALUE) {
		duration = (double)fmt_ctx->duration / AV_TIME_BASE;
	}

	avformat_close_input(&fmt_ctx);
	return duration;
}

static void on_frontend_event(enum obs_frontend_event event, void *private_data) {
	if (event == OBS_FRONTEND_EVENT_RECORDING_STARTED) {
		send_pipe_event("{\"type\":\"recording_started\"}");
	}

	if (event == OBS_FRONTEND_EVENT_RECORDING_STOPPED) {
		const char *path = obs_frontend_get_last_recording();

		if (path && *path) {
			double duration = get_clip_duration_from_file(path);
			char buf[128];
			snprintf(buf, sizeof(buf), "{\"type\":\"recording_stopped\",\"duration\":%.1f}", duration);
			send_pipe_event(buf);
		}
		else {
			send_pipe_event("{\"type\":\"recording_stopped\"}");
		}
	}

	if (event == OBS_FRONTEND_EVENT_REPLAY_BUFFER_STARTED) {
		send_pipe_event("{\"type\":\"replay_started\"}");
	}

	if (event == OBS_FRONTEND_EVENT_REPLAY_BUFFER_STOPPED) {
		send_pipe_event("{\"type\":\"replay_stopped\"}");
	}

	if (event == OBS_FRONTEND_EVENT_REPLAY_BUFFER_SAVED) {
		obs_output_t *output = obs_frontend_get_replay_buffer_output();
		
		if (!output) {
			return;
		}

		calldata_t cd = {0};
		proc_handler_t *ph = obs_output_get_proc_handler(output);
		proc_handler_call(ph, "get_last_replay", &cd);
		const char *path = calldata_string(&cd, "path");

		if (path && *path) {
			double duration = get_clip_duration_from_file(path);
			char buf[128];
			snprintf(buf, sizeof(buf), "{\"type\":\"replay_saved\",\"duration\":%.1f}", duration);
			send_pipe_event(buf);
		}
		else {
			send_pipe_event("{\"type\":\"replay_saved\"}");
		}

		calldata_free(&cd);
		obs_output_release(output);
	}
}

static bool run_overlay(HANDLE *process_handle) {
	char overlay_path[MAX_PATH];

	const char *module_path = obs_get_module_data_path(obs_current_module());
	snprintf(overlay_path, sizeof(overlay_path), "%s\\overplay.exe", module_path);

	STARTUPINFOA si = {.cb = sizeof(si)};
	PROCESS_INFORMATION pi;
	
	BOOL result = CreateProcessA(overlay_path, NULL, NULL, NULL, FALSE, CREATE_NO_WINDOW, NULL, NULL, &si, &pi);

	if (result) {
		*process_handle = pi.hProcess;
		CloseHandle(pi.hThread);
	}

	return result;
}

static bool is_overlay_running() {
	HANDLE pipe = CreateFileA(PIPE_NAME, GENERIC_WRITE, 0, NULL, OPEN_EXISTING, 0, NULL);
	
	if (pipe != INVALID_HANDLE_VALUE) {
		CloseHandle(pipe);
		return true;
	}
	
	return false;
}

bool app_run(void) {
	if (!is_overlay_running()) {
		run_overlay(&overlay_process);
	}

	obs_frontend_add_event_callback(on_frontend_event, NULL);

	return true;
}

void app_shutdown(void) {
	obs_frontend_remove_event_callback(on_frontend_event, NULL);

	if (overlay_process) {
		TerminateProcess(overlay_process, 0);
		CloseHandle(overlay_process);
	
		overlay_process = NULL;
	}
}
