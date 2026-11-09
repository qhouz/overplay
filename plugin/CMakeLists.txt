cmake_minimum_required(VERSION 3.28...3.30)

include("${CMAKE_CURRENT_SOURCE_DIR}/cmake/common/bootstrap.cmake" NO_POLICY_SCOPE)

project(${_name} VERSION ${_version})

option(ENABLE_FRONTEND_API "Use obs-frontend-api for UI functionality" OFF)
option(ENABLE_QT "Use Qt functionality" OFF)

include(compilerconfig)
include(defaults)
include(helpers)

add_library(${CMAKE_PROJECT_NAME} MODULE)

file(READ "${CMAKE_CURRENT_SOURCE_DIR}/buildspec.json" _buildspec)
string(JSON _obs_version GET ${_buildspec} dependencies obs-studio version)
unset(_buildspec)
list(APPEND CMAKE_MODULE_PATH "${OBS_DEPS_LOCAL_ROOT}/obs-studio-${_obs_version}/cmake/finders")
unset(_obs_version)

find_package(libobs REQUIRED)
target_link_libraries(${CMAKE_PROJECT_NAME} PRIVATE OBS::libobs)

find_package(FFmpeg COMPONENTS avformat avutil REQUIRED)
target_link_libraries(${CMAKE_PROJECT_NAME} PRIVATE
  FFmpeg::avformat
  FFmpeg::avutil
)

if(ENABLE_FRONTEND_API)
  find_package(obs-frontend-api REQUIRED)
  target_link_libraries(${CMAKE_PROJECT_NAME} PRIVATE OBS::obs-frontend-api)
endif()

if(ENABLE_QT)
  find_package(Qt6 COMPONENTS Widgets Core)
  target_link_libraries(${CMAKE_PROJECT_NAME} PRIVATE Qt6::Core Qt6::Widgets)
  target_compile_options(
    ${CMAKE_PROJECT_NAME}
    PRIVATE $<$<C_COMPILER_ID:Clang,AppleClang>:-Wno-quoted-include-in-framework-header -Wno-comma>
  )
  set_target_properties(
    ${CMAKE_PROJECT_NAME}
    PROPERTIES AUTOMOC ON AUTOUIC ON AUTORCC ON
  )
endif()

file(GLOB_RECURSE PLUGIN_SOURCES
  src/*.c
  src/*.h
)

target_sources(${CMAKE_PROJECT_NAME} PRIVATE ${PLUGIN_SOURCES})

set_target_properties_plugin(${CMAKE_PROJECT_NAME} PROPERTIES OUTPUT_NAME ${_name})